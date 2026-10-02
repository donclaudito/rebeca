/**
 * Geração das opções de thumbnail — a etapa que faltava no pipeline.
 *
 * **O que existia antes:** `criar-thumbnail` é função de LLM e devolve **conceito** (rótulo, o que a arte
 * deve mostrar, texto na arte). Nenhuma etapa gerava **imagem**: `spec-midia.json` não tinha a seção,
 * `MediaStage` não tinha o valor e não havia um único arquivo `option-*` no repositório. O dono do produto
 * resumiu: *"a arte da thumbnail não tem gerador em canto nenhum"*.
 *
 * Quatro decisões que valem explicação, e todas vêm de defeito já pago neste projeto:
 *
 * 1. **Idempotência ANTES do gasto.** O nome do arquivo sai do `plan()` — que não toca a rede — e a
 *    contagem de opções pendentes vem daí. O portão de custo é aplicado sobre **o que falta gerar**, não
 *    sobre o total pedido: reexecutar um episódio já pronto não pode exigir orçamento para algo que não
 *    vai ser gerado.
 * 2. **Portão de entrada antes de qualquer chamada.** Provedor que cobra **tem** de declarar
 *    `costPerImageUsd > 0`; se declarar zero, o portão não tem o que comparar e a função **recusa**. Foi
 *    exatamente o furo que o `rebeca-qa` reproduziu no `ADR-010` (21 arquivos e US$ 200 lançados antes de
 *    qualquer bloqueio).
 * 3. **Allow-list por canal, antes de tudo.** `assertProviderAllowed` roda primeiro e recusa fornecedor
 *    `PROIBIDO` ou `NAO-VERIFICADO` com o fundamento e a URL na mensagem. Nada é gerado e nada é gasto.
 * 4. **Custo real por opção, no livro.** Cada imagem gerada entra em `.rebeca/custos.csv` com o preço
 *    real do provedor. Opção **reusada não gera linha** — registrar de novo transformaria a prova de
 *    idempotência em ficção.
 */

import { statSync } from 'node:fs';
import type {
  MediaAsset,
  ThumbnailProvider,
  ThumbnailRequest,
} from '../../src/media/contract.js';
import type {
  ThumbnailOptionView as ViewThumbnailOption,
  ThumbnailRunView,
} from '../../src/media/view.js';
import { MEDIA_LIMITS } from '../../src/media/limits.js';
import { assertProviderAllowed } from './allow-list.js';
import { loadChannelMediaSpec } from './channel-spec.js';
import { hasMiniMaxKey } from './config.js';
import { hasOpenAiKey } from './providers/openai.js';
import { openAiThumbnailProvider } from './providers/openai.js';
import { assetFingerprint } from './hash.js';
import { assertMonthlyBudgetForNow, ledgerPath, ledgerRowCount, recordAssetCost } from './ledger.js';
import { miniMaxThumbnailProvider } from './providers/minimax.js';
import { SIMULATED_PROVIDERS } from './providers/simulated.js';
import {
  emptyManifest,
  findReusable,
  readManifest,
  resolveStoredPath,
  upsertAssets,
  writeManifest,
} from './manifest.js';
import { assetsRelativePath, repoRelativePath } from './paths.js';
import { MediaBudgetError } from '../../src/media/limits.js';

/** Uma opção a gerar: cada uma testa uma hipótese diferente (skill `rebeca-branding`). */
export interface ThumbnailOptionSpec {
  /** `a`, `b`, `c`, `d`. Vira `opcao-a`, `opcao-b`… no nome do arquivo. */
  readonly optionId: string;
  /** Qual ideia esta opção testa. Vai ao manifesto: "4 opções" sem hipótese não diz nada. */
  readonly hypothesis: string;
  readonly prompt: string;
  readonly textOnImage: string;
}

export interface GenerateThumbnailsInput {
  readonly channelId: string;
  readonly episodeId: string;
  readonly promptVersion: string;
  readonly options: readonly ThumbnailOptionSpec[];
  readonly provider: ThumbnailProvider;
  /** Sobreposição de teste — em produção o "agora" é o relógio. */
  readonly now?: Date;
  /** Tamanho da arte. O padrão é o da thumbnail do YouTube. */
  readonly width?: number;
  readonly height?: number;
  /**
   * `sub` do Google de quem pediu a geração (`ADR-014`).
   *
   * Vem da guarda, não do corpo do pedido. Serve para o livro de custos registrar quem gastou — a
   * mesma razão da camada de IA. Ausente nos caminhos sem sessão (CLI, Fase 0), e a célula fica vazia
   * em vez de receber um valor inventado.
   */
  readonly identidadeSub?: string;
}

/** Uma opção, como o relatório e a tela a leem. O tipo vive no contrato do navegador. */
export type ThumbnailOptionView = ViewThumbnailOption;

export type ThumbnailRunResult = Omit<ThumbnailRunView, 'motivoDoProvedor'>;

/** Tamanho oficial da thumbnail do YouTube: 1280×720 (16:9). */
const THUMB_WIDTH = 1280;
const THUMB_HEIGHT = 720;

/** Um personagem do canal, como o chamador o declara. Só o que a ficha tem de fato. */
export interface PersonagemDoCanal {
  readonly name: string;
  readonly role: string;
  /** Revisão da ficha (`v2`…). Entra no prompt como procedência textual. */
  readonly sheetVersion?: string;
}

/** O que o chamador sabe sobre este conteúdo e este canal. */
export interface ContextoDeThumbnail {
  readonly personagens?: readonly PersonagemDoCanal[];
  readonly tema?: string;
  readonly titulo?: string;
  /** Paleta do Brand Kit, em hex. Entra no prompt como direção de cor. */
  readonly paleta?: readonly string[];
}

/**
 * O trecho do prompt que descreve **quem** aparece na arte.
 *
 * **Por que isto deixou de ser texto fixo.** Os prompts estavam escritos à mão, descrevendo "a small round
 * friendly girl" e afirmando logo depois que *"the official character sheet does not exist yet"*. Quando o
 * canal passou a ter personagem oficial cadastrado (Tico, ficha `v2`), as duas coisas ficaram erradas ao
 * mesmo tempo: a arte mirava o personagem errado **e** o prompt declarava uma ausência que já não existia.
 * O dono do produto viu: *"ele criou o personagem mas não gerou a thumb"*.
 *
 * **O que continua faltando, e o prompt diz com todas as letras:** o personagem tem **ficha**, não tem
 * **imagem de referência**. Descrição em texto faz o modelo desenhar *um* cachorro curioso; não faz
 * desenhar *o mesmo* cachorro em todo episódio — isso exige referência visual (`subject_reference`), e a
 * arte do personagem segue pendente no canal. A frase não é enfeite: é o que impede o resultado de se
 * passar por consistência de personagem (invariante nº 3).
 */
export function descricaoDePersonagem(contexto: ContextoDeThumbnail): string {
  const oficiais = (contexto.personagens ?? []).filter(
    (personagem) => personagem.name.trim().length > 0 && personagem.role.trim().length > 0,
  );

  if (oficiais.length === 0) {
    return (
      'Nenhum personagem foi declarado para este conteúdo: mantenha a composição no tema e não invente um ' +
      'personagem recorrente.'
    );
  }

  const lista = oficiais.map((p) => `${p.name.trim()} (${p.role.trim()})`).join('; ');

  return (
    `Personagens deste canal, segundo a ficha registrada: ${lista}. Desenhe-os com formas simples e ` +
    'legíveis para crianças de 3 a 6 anos. Observação: existe apenas a ficha em texto — ainda NÃO existe ' +
    'imagem de referência, então trate o desenho como interpretação e não o apresente como o visual canônico.'
  );
}

/**
 * As quatro hipóteses, montadas a partir do **contexto real** do conteúdo.
 *
 * Não são quatro variações do mesmo desenho: a skill `rebeca-branding` pede hipóteses **distintas**,
 * porque quatro apostas iguais não informam nada quando o CTR voltar. O texto de cada uma fica em pt-BR e
 * com até 3 palavras, pela régua de legibilidade a 168×94.
 */
export function opcoesPara(contexto: ContextoDeThumbnail = {}): readonly ThumbnailOptionSpec[] {
  const personagens = descricaoDePersonagem(contexto);
  const tema = contexto.tema?.trim();
  const paleta = (contexto.paleta ?? []).filter((cor) => /^#[0-9a-fA-F]{6}$/.test(cor));
  const direcaoDeCor =
    paleta.length > 0 ? ` Direção de cor (paleta do canal): ${paleta.slice(0, 6).join(', ')}.` : '';
  const sobreTema = tema !== undefined && tema.length > 0 ? ` O episódio é sobre: ${tema}.` : '';
  const contextoComum =
    'Ilustração infantil 2D, traço grosso e limpo, formas arredondadas, sem NENHUM texto na arte.' +
    sobreTema +
    ' ' +
    personagens +
    direcaoDeCor;

  return [
    {
      optionId: 'a',
      hypothesis: 'Foco no personagem: rosto grande e expressão de descoberta',
      textOnImage: 'OLHA ISSO!',
      prompt: `${contextoComum} Composição: primeiro plano do rosto do personagem principal, surpreso e feliz, centralizado.`,
    },
    {
      optionId: 'b',
      hypothesis: 'Foco no objeto: o elemento que o episódio ensina, em destaque',
      textOnImage: tema !== undefined && tema.length > 0 ? tema.toUpperCase().slice(0, 16) : 'SETE CORES',
      prompt: `${contextoComum} Composição: um objeto grande e marcante que represente o tema do episódio, centralizado, sem personagens no quadro.`,
    },
    {
      optionId: 'c',
      hypothesis: 'Contraste: fundo escuro com o elemento claro, para furar a rolagem',
      textOnImage: 'ACHOU!',
      prompt: `${contextoComum} Composição: fundo noturno escuro com um único elemento brilhante emitindo luz quente, contraste forte, aconchegante e não assustador.`,
    },
    {
      optionId: 'd',
      hypothesis: 'Expressão: ação de apontar, com o gesto legível mesmo pequeno',
      textOnImage: 'QUAL E A SUA?',
      prompt: `${contextoComum} Composição: o personagem principal apontando para cima com um braço, silhueta bem legível, a mão grande no quadro.`,
    },
  ];
}

/** As quatro hipóteses **sem contexto** — usadas pela CLI e por quem não tem o dado do canal. */
export const OPCOES_PADRAO: readonly ThumbnailOptionSpec[] = opcoesPara();

/**
 * Qual provedor usar, e **por quê**.
 *
 * Com chave da MiniMax configurada, gera arte de verdade (pago, US$ 0,0035/imagem). Sem chave, cai no
 * simulado local — arquivo real, custo zero, **prova de máquina**. A escolha é declarada no retorno
 * (`simulated`) e a tela diz qual dos dois aconteceu: cair no simulado em silêncio faria o humano achar
 * que tem arte quando tem texto sobre fundo chapado.
 */
export function providerForThumbnails(): { provider: ThumbnailProvider; motivo: string } {
  /*
   * Ordem de preferência, e o critério é **chave que existe** — não preferência estética.
   *
   * 1. OpenAI (`gpt-image-2.5-sunburst`): a chave já está nesta máquina e a política oficial de menores
   *    (*Under-18 guidance*) **prevê** servir público menor de 18 com salvaguardas, em vez de proibir.
   * 2. MiniMax (`image-01`): preço fixo por imagem e 16:9 nativo, mas exige chave própria.
   * 3. Simulado: arquivo real, custo zero, **prova de máquina** — e a tela diz isso.
   */
  if (hasOpenAiKey()) {
    return {
      provider: openAiThumbnailProvider,
      motivo:
        'Arte gerada de verdade pela OpenAI (gpt-image-2.5-sunburst) em 1280×720. O custo real de cada ' +
        'imagem é lido dos tokens que a resposta devolve e lançado no livro.',
    };
  }
  if (hasMiniMaxKey()) {
    return {
      provider: miniMaxThumbnailProvider,
      motivo: 'Chave da MiniMax configurada: as opções são arte gerada de verdade (US$ 0,0035 por imagem).',
    };
  }
  return {
    provider: SIMULATED_PROVIDERS.thumbnail,
    motivo:
      'Sem chave de geração de imagem neste ambiente: as opções são geradas localmente pelo ffmpeg, custo zero — ' +
      'é prova de máquina (fundo e texto, sem personagem), não arte publicável. Configure a chave para gerar arte real.',
  };
}

/** Só `[a-z0-9]` no identificador da opção — ele entra no nome do arquivo. */
const OPTION_ID = /^[a-z0-9]{1,8}$/;

function fileBytes(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

/**
 * Valida as opções antes de qualquer coisa.
 *
 * Quatro `optionId` iguais produziriam **uma** imagem e quatro linhas no relatório dizendo que há quatro
 * — o tipo de mentira que este projeto já corrigiu em tela. Recusar cedo é mais barato que explicar
 * depois.
 */
function assertOptions(options: readonly ThumbnailOptionSpec[]): void {
  if (options.length === 0) {
    throw new MediaBudgetError('custo-invalido', 'Nenhuma opção de thumbnail foi pedida — não há o que gerar.');
  }
  const vistos = new Set<string>();
  for (const option of options) {
    if (!OPTION_ID.test(option.optionId)) {
      throw new MediaBudgetError(
        'custo-invalido',
        `Identificador de opção inválido: "${option.optionId}". Use apenas letras minúsculas e números (ele entra no nome do arquivo).`,
      );
    }
    if (vistos.has(option.optionId)) {
      throw new MediaBudgetError(
        'custo-invalido',
        `Identificador de opção repetido: "${option.optionId}". Cada opção precisa de um id próprio — senão duas opções disputariam o mesmo arquivo e o relatório diria que há mais arte do que existe.`,
      );
    }
    vistos.add(option.optionId);
    if (option.prompt.trim().length === 0) {
      throw new MediaBudgetError('custo-invalido', `A opção "${option.optionId}" está sem prompt de arte.`);
    }
  }
}

function buildEntry(
  option: ThumbnailOptionSpec,
  asset: { path: string; hash: string; sha256: string; providerId: string; model: string; costUsd: number; simulated: boolean },
  input: { channelId: string; episodeId: string; promptVersion: string; now: Date },
): MediaAsset {
  return {
    channelId: input.channelId,
    episodeId: input.episodeId,
    stage: 'thumbnail',
    // Thumbnail é imagem, não vídeo: `kind` decide o que o `ffprobe` pode medir, e pedir duração a um PNG
    // faria o pipeline falhar por um motivo que não é defeito.
    kind: 'imagem',
    key: `opcao-${option.optionId}`,
    version: 1,
    path: repoRelativePath(asset.path),
    pathFromAssets: assetsRelativePath(asset.path),
    hash: asset.hash,
    sha256: asset.sha256,
    durationMs: 0,
    bytes: fileBytes(asset.path),
    providerId: asset.providerId,
    model: asset.model,
    promptVersion: input.promptVersion,
    costUsd: asset.costUsd,
    simulated: asset.simulated,
    // A referência visual vem do `ADR-010`: enquanto o Character Sheet não existir, é sintética — e isso
    // fica escrito no manifesto, não presumido.
    reference: 'sintetica',
    approved: false,
    recordedAt: input.now.toISOString(),
  };
}

/**
 * Gera as opções de thumbnail de um episódio.
 *
 * A ordem das operações **é** o desenho, como no resto do pipeline:
 * `allow-list → validação → plano (sem rede) → quem falta gerar → portão de custo → gerar → livro → manifesto`.
 */
export async function generateThumbnails(input: GenerateThumbnailsInput): Promise<ThumbnailRunResult> {
  const now = input.now ?? new Date();
  const { channelId, episodeId, provider } = input;
  const scope = channelId;
  const width = input.width ?? THUMB_WIDTH;
  const height = input.height ?? THUMB_HEIGHT;

  assertOptions(input.options);

  // --- PORTÃO DE FORNECEDOR (antes de qualquer rede) --------------------------
  assertProviderAllowed({
    channelId,
    provider: provider.id,
    model: provider.model,
    purpose: 'thumbnail',
  });

  // --- PLANO: onde cada arquivo nasceria, sem gerar nada ---------------------
  const requests: Array<{ option: ThumbnailOptionSpec; request: ThumbnailRequest; hash: string; sha256: string; path: string }> = [];
  input.options.forEach((option, index) => {
    const request: ThumbnailRequest = {
      channelId,
      scopeChannelId: scope,
      episodeId,
      promptVersion: input.promptVersion,
      optionId: option.optionId,
      prompt: option.prompt,
      textOnImage: option.textOnImage,
      hypothesis: option.hypothesis,
      width,
      height,
      // Seed determinística por opção: mesma entrada ⇒ mesma arte. Sem isso, a idempotência seria
      // nominal — o arquivo teria o mesmo nome e conteúdo diferente, que é pior que não ter idempotência.
      seed: seedFor(`${episodeId}:${option.optionId}:${index}`),
    };
    const plan = provider.plan(request);
    requests.push({ option, request, hash: plan.hash, sha256: plan.sha256, path: plan.path });
  });

  let manifest = readManifest(scope, channelId, episodeId) ?? emptyManifest(channelId, episodeId, episodeId, now);

  // --- QUEM FALTA GERAR (idempotência antes do gasto) ------------------------
  const pendentes = requests.filter(
    (item) => findReusable(manifest, 'thumbnail', `opcao-${item.option.optionId}`, item.hash) === undefined,
  );

  // --- PORTÕES DE GASTO (sobre o que FALTA, não sobre o total pedido) --------
  const estimativa = pendentes.length * provider.costPerImageUsd;

  if (pendentes.length > 0 && !provider.simulated && !(provider.costPerImageUsd > 0)) {
    throw new MediaBudgetError(
      'estimativa-obrigatoria',
      `O provedor "${provider.id}" cobra (simulated=false) mas declara costPerImageUsd=${provider.costPerImageUsd}. ` +
        'Sem preço por imagem o portão de entrada não tem o que comparar com o teto, e a geração aconteceria ' +
        'antes de qualquer verificação. Nada foi gerado.',
    );
  }

  // Só checa orçamento quando há gasto real a fazer: reexecução de episódio pronto não pode exigir
  // orçamento para algo que não vai ser gerado.
  const budget = estimativa > 0 ? assertMonthlyBudgetForNow(now, estimativa) : null;

  // --- GERAR O QUE FALTA, REUSAR O RESTO -------------------------------------
  const views: ThumbnailOptionView[] = [];
  const entries: MediaAsset[] = [];
  let created = 0;
  let reused = 0;

  for (const item of requests) {
    const key = `opcao-${item.option.optionId}`;
    const existente = findReusable(manifest, 'thumbnail', key, item.hash);

    if (existente !== undefined) {
      reused += 1;
      entries.push(existente);
      views.push({
        optionId: item.option.optionId,
        key,
        hypothesis: item.option.hypothesis,
        textOnImage: item.option.textOnImage,
        path: resolveStoredPath(existente),
        pathFromAssets: existente.pathFromAssets,
        hash: existente.hash,
        bytes: existente.bytes,
        providerId: existente.providerId,
        model: existente.model,
        costUsd: existente.costUsd,
        simulated: existente.simulated,
        reused: true,
      });
      continue;
    }

    const startedAt = performance.now();
    const asset = await provider.generate(item.request);
    const tempoMin = Math.max(0, (performance.now() - startedAt) / 60_000);

    const entry = buildEntry(item.option, { ...asset, sha256: item.sha256 }, {
      channelId,
      episodeId,
      promptVersion: input.promptVersion,
      now,
    });
    entries.push(entry);
    created += 1;

    // O custo entra AQUI, onde se sabe que houve geração. A opção reusada não gera linha.
    recordAssetCost({
      channelId,
      channelName: loadChannelMediaSpec(channelId)?.nome,
      episodeId,
      stage: 'thumbnail',
      providerId: asset.providerId,
      model: asset.model,
      promptVersion: input.promptVersion,
      hash8: asset.hash,
      durationMs: 0,
      costUsd: asset.costUsd,
      simulated: asset.simulated,
      tempoMin,
      now,
      ...(input.identidadeSub === undefined ? {} : { identidadeSub: input.identidadeSub }),
    });

    views.push({
      optionId: item.option.optionId,
      key,
      hypothesis: item.option.hypothesis,
      textOnImage: item.option.textOnImage,
      path: asset.path,
      pathFromAssets: entry.pathFromAssets,
      hash: asset.hash,
      bytes: entry.bytes,
      providerId: asset.providerId,
      model: asset.model,
      costUsd: asset.costUsd,
      simulated: asset.simulated,
      reused: false,
    });
  }

  manifest = upsertAssets(manifest, entries, now);
  const manifestPath = writeManifest(manifest, scope);

  const spentNowUsd = views.filter((view) => !view.reused).reduce((total, view) => total + view.costUsd, 0);

  return {
    channelId,
    episodeId,
    providerId: provider.id,
    model: provider.model,
    simulated: provider.simulated,
    options: views,
    created,
    reused,
    manifestPath,
    cost: {
      spentNowUsd,
      episodeTotalUsd: manifest.assets
        .filter((asset) => asset.stage === 'thumbnail')
        .reduce((total, asset) => total + asset.costUsd, 0),
      perImageUsd: provider.costPerImageUsd,
      monthlyUsd: budget?.projectedUsd ?? 0,
      monthlyLimitUsd: MEDIA_LIMITS.monthlyUsd,
      ledgerPath: ledgerPath(),
      ledgerRows: ledgerRowCount(),
    },
  };
}

/**
 * Seed determinística a partir do identificador da opção.
 *
 * Determinismo aqui não é capricho: sem seed fixa, o provedor devolveria arte diferente a cada execução
 * **com o mesmo nome de arquivo**, e a idempotência viraria fachada — o pipeline reusaria o hash e o
 * humano veria uma imagem que ninguém aprovou. O `fingerprint` é o mesmo hash canônico do resto do
 * pipeline, para não existirem duas noções de "mesma entrada".
 */
export function seedFor(text: string): number {
  const hex = assetFingerprint({
    stage: 'thumbnail',
    promptVersion: 'seed-v1',
    providerId: 'rebeca',
    model: 'seed',
    input: { text },
    params: {},
  }).slice(0, 8);
  return Number.parseInt(hex, 16) % 2_147_483_647;
}

/**
 * Contrato do pipeline de mídia — o único vocabulário que atravessa as quatro etapas.
 *
 * Por que este arquivo existe separado de `server/media/`:
 *
 * 1. **O invariante nº 7 do projeto (provedores substituíveis) precisa de um lugar para morar.** A tela
 *    e o pipeline falam o mesmo tipo; trocar MiniMax por Luma, ou o TTS por outro fornecedor, não pode
 *    mudar roteiro, timeline nem interface. Se cada etapa tivesse o seu próprio formato de retorno, a
 *    troca de provedor viraria refatoração de pipeline — e o usuário veria a diferença.
 * 2. **A Fase 0 (provedor simulado, custo zero) e a Fase 1 (provedor real, pago) precisam do MESMO
 *    contrato.** É isso que permite provar o pipeline inteiro hoje, sem gastar, e trocar só o adapter
 *    amanhã. O que muda entre as fases é `providerId`, `model`, `costUsd` e `simulated` — nunca a forma.
 * 3. `import type` só: nada aqui executa no navegador, nada aqui toca disco ou rede.
 *
 * Regra de ouro do módulo: **todo provedor devolve `GeneratedAsset`**. Os quatro têm a mesma forma de
 * retorno (`path`, `providerId`, `model`, `costUsd`, `hash`, `simulated`), e só o TTS acrescenta
 * `durationMs` — porque é a duração **medida da fala** que manda na timeline (ver `server/media/timeline.ts`).
 */

/** Etapas do pipeline que produzem artefato. Espelha a cadeia da skill `rebeca-ia-video`. */
export type MediaStage = 'imagem' | 'animacao' | 'voz' | 'musica' | 'render' | 'legenda';

/** Perfil de saída. O Short não é "o longo menor": é recorte vertical do mesmo material. */
export type RenderProfile = 'longo-16x9' | 'short-9x16';

/** Natureza do arquivo — usada para decidir o que pode ser medido por `ffprobe`. */
export type MediaKind = 'imagem' | 'video' | 'audio' | 'texto';

/**
 * Resultado comum a **todos** os provedores.
 *
 * `simulated` não é enfeite: é a informação que impede a Fase 0 de se passar por geração real. Um
 * ativo simulado que chega ao humano sem esse rótulo seria mentira de produto (e o `ADR-005` ainda
 * exige rotular *deep synthesis* quando o provedor for a MiniMax — mesmo rótulo, outro motivo).
 *
 * `hash` é o hash de **entrada** (8 primeiros hex de sha256 sobre artefato + versão de prompt +
 * provedor/modelo + parâmetros). Mesma entrada ⇒ mesmo `hash` ⇒ mesmo nome de arquivo ⇒ reuso sem
 * pagar de novo. `costUsd` é sempre o custo **real**; na Fase 0 é `0` porque o ffmpeg local custa zero
 * — e `0` é a verdade, não "não verificado".
 */
export interface GeneratedAsset {
  readonly path: string;
  readonly providerId: string;
  readonly model: string;
  readonly costUsd: number;
  readonly hash: string;
  readonly simulated: boolean;
}

/**
 * Linha de fala sintetizada.
 *
 * `durationMs` é a duração **medida do arquivo** (ffprobe), não a duração que pedimos ao provedor.
 * A diferença importa: se a timeline usasse a duração pedida, o vídeo e o áudio divergiriam por
 * arredondamento do fornecedor, e a legenda sairia fora de sincronia. Medir o arquivo é o que faz a
 * timeline ser a fonte da verdade.
 */
export interface SpokenLine extends GeneratedAsset {
  readonly durationMs: number;
}

/** Uma cena, do ponto de vista do roteiro. Não contém caminho: caminho é consequência do hash. */
export interface SceneSpec {
  readonly id: string;
  /** Ordem 1-based no episódio. A timeline ordena por aqui, não pela ordem do array. */
  readonly index: number;
  /** Texto narrado — é o que vai ao TTS e o que vira legenda. */
  readonly narration: string;
  /** Texto desenhado na imagem (placeholder da Fase 0). */
  readonly onScreenText: string;
  readonly imagePrompt: string;
  readonly emotion: string;
  readonly seed: number;
}

/** Cena já resolvida: tem artefato, tem tempo, e o tempo vem da fala medida. */
export interface TimelineScene {
  readonly spec: SceneSpec;
  readonly startMs: number;
  readonly endMs: number;
  readonly durationMs: number;
  /** Fronteiras em quadros inteiros — é o que permite pedir `-frames:v` exato ao ffmpeg. */
  readonly startFrame: number;
  readonly endFrame: number;
  readonly durationFrames: number;
  readonly spoken: SpokenLine;
  readonly image: GeneratedAsset;
  readonly clip: GeneratedAsset;
}

/** Trilha sonora com o ganho aplicado na mixagem (25% por padrão — ver `MEDIA_LIMITS`). */
export interface MusicTrack {
  readonly asset: GeneratedAsset;
  readonly durationMs: number;
  readonly gain: number;
}

/**
 * A timeline do episódio — **fonte da verdade** de duração.
 *
 * Tudo que é tempo (cena, corte, legenda, render) sai daqui. `maxDriftMs` é o desvio máximo entre o
 * início de legenda e o início real da fala acumulada; ele é calculado, não prometido — e o teste
 * `src/media/__tests__/media-timeline.test.ts` cobra o teto de 200 ms com muitas cenas.
 */
export interface EpisodeTimeline {
  readonly channelId: string;
  readonly episodeId: string;
  readonly slug: string;
  readonly fps: number;
  readonly scenes: readonly TimelineScene[];
  readonly totalMs: number;
  readonly totalFrames: number;
  /**
   * Faixa de voz já alinhada quadro a quadro com as cenas.
   *
   * `null` até a etapa de montagem rodar: a timeline nasce das falas medidas e só depois a voz é
   * alinhada. Manter o campo explícito impede o render de rodar com áudio ausente achando que está tudo
   * pronto.
   */
  readonly voiceTrackPath: string | null;
  readonly music: MusicTrack | null;
  readonly maxDriftMs: number;
}

/** Especificação de render — formato é contrato, não preferência (skill `rebeca-ia-video`). */
export interface RenderSpec {
  readonly profile: RenderProfile;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly videoCodec: 'libx264';
  readonly crf: number;
  readonly preset: string;
  readonly pixelFormat: 'yuv420p';
  readonly audioCodec: 'aac';
  readonly audioBitrate: string;
  readonly audioSampleRate: number;
  /** `+faststart`: metadados no começo do arquivo, para o player não baixar tudo antes de abrir. */
  readonly faststart: true;
  readonly loudness: {
    readonly integratedLufs: number;
    readonly truePeakDb: number;
    readonly lra: number;
  };
  readonly musicGain: number;
}

/**
 * Registro de um ativo no manifesto do episódio.
 *
 * `approved` existe porque **artefato aprovado nunca é sobrescrito**: o pipeline reusa pelo hash, e
 * quando o conteúdo muda gera versão nova. Sem esse campo, um render aprovado poderia ser trocado por
 * outro de mesmo nome e a aprovação humana passaria a valer para um vídeo que ninguém viu.
 */
export interface MediaAsset {
  readonly channelId: string;
  readonly episodeId: string;
  readonly stage: MediaStage;
  readonly kind: MediaKind;
  /** Identificador curto dentro da etapa: `cena-01`, `trilha`, `longo`, `short`, `legenda`. */
  readonly key: string;
  readonly version: number;
  /** Caminho relativo à raiz do repositório — auditável e legível no relatório. */
  readonly path: string;
  /**
   * Caminho relativo à raiz de ativos (`.rebeca/assets`).
   *
   * É este que se usa para **reabrir o arquivo**: continua válido mesmo que a raiz do repositório mude
   * (ou que a suíte aponte `REBECA_ASSETS_ROOT` para um diretório temporário).
   */
  readonly pathFromAssets: string;
  readonly hash: string;
  readonly sha256: string;
  readonly durationMs: number;
  readonly bytes: number;
  readonly providerId: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly costUsd: number;
  readonly simulated: boolean;
  /**
   * De onde veio a referência visual. Na Fase 0 é sempre `sintetica`: **o Character Sheet da Luna não
   * existe no repositório**. Marcar isso no manifesto é o que impede a Fase 0 de fingir que a arte é a
   * Luna oficial (invariante nº 3 — consistência de personagem).
   */
  readonly reference: AssetReference;
  readonly approved: boolean;
  readonly recordedAt: string;
}

export type AssetReference = 'sintetica' | 'character-sheet' | 'indisponivel';

/* =============================================================================
   Pedidos aos provedores
   ============================================================================= */

/**
 * Campos que **todo** pedido carrega.
 *
 * `scopeChannelId` é o canal em que o pipeline está rodando; `channelId` é o dono do ativo. Os dois
 * existem separados de propósito: quando divergem, alguém está tentando gravar ativo de um canal na
 * pasta de outro — o vazamento que o invariante nº 2 proíbe. O provedor recusa antes de escrever
 * (`server/media/paths.ts`), em vez de confiar que o chamador acertou.
 */
export interface MediaRequestBase {
  readonly channelId: string;
  readonly scopeChannelId: string;
  readonly episodeId: string;
  /** Versão do prompt que originou o pedido. Entra no hash: prompt novo ⇒ nome novo. */
  readonly promptVersion: string;
}

export interface ImageRequest extends MediaRequestBase {
  readonly sceneId: string;
  readonly prompt: string;
  readonly onScreenText: string;
  readonly width: number;
  readonly height: number;
  readonly seed: number;
}

export interface VideoRequest extends MediaRequestBase {
  readonly sceneId: string;
  readonly imagePath: string;
  /** Hash da imagem de entrada. Vai ao hash no lugar do caminho absoluto (que muda por máquina). */
  readonly imageHash: string;
  readonly durationMs: number;
  readonly frames: number;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly motion: string;
}

export interface TtsRequest extends MediaRequestBase {
  readonly sceneId: string;
  readonly text: string;
  readonly voiceId: string;
  readonly lang: 'pt-BR';
}

export interface MusicRequest extends MediaRequestBase {
  readonly mood: string;
  readonly durationMs: number;
}

/* =============================================================================
   As quatro interfaces — o invariante nº 7 em forma de código
   ============================================================================= */

export interface ImageProvider {
  readonly id: string;
  render(input: ImageRequest): Promise<GeneratedAsset>;
}

export interface VideoProvider {
  readonly id: string;
  animate(input: VideoRequest): Promise<GeneratedAsset>;
}

export interface TtsProvider {
  readonly id: string;
  synthesize(input: TtsRequest): Promise<SpokenLine>;
}

export interface MusicProvider {
  readonly id: string;
  compose(input: MusicRequest): Promise<GeneratedAsset>;
}

/** O conjunto dos quatro, para o pipeline receber "um provedor de cada" sem saber qual é. */
export interface MediaProviderSet {
  readonly image: ImageProvider;
  readonly video: VideoProvider;
  readonly tts: TtsProvider;
  readonly music: MusicProvider;
}

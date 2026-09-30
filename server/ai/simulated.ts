/**
 * Provedor simulado — a rede de segurança que mantém o app utilizável sem chave de API.
 *
 * Por que isto existe (e por que não é "dado falso disfarçado"):
 *
 * 1. O produto tem de ser demonstrável e testável sem gastar dinheiro. Sem isto, cada `pnpm test`
 *    seria uma decisão de orçamento.
 * 2. A saída simulada é **validada pelo mesmo schema** que a saída real. Se o simulado não passa, o
 *    schema está errado — o que transforma a simulação em teste do contrato, não em enfeite.
 * 3. A interface **diz** que é simulação (`simulated: true` chega no resultado e a tela mostra o
 *    aviso). Simulação que se passa por geração real é mentira de produto, e o usuário a tomaria por
 *    conteúdo de verdade.
 *
 * O que o simulado **não** faz: não inventa número de desempenho do canal. Onde a resposta depende de
 * dado que não existe, ele devolve exatamente a ressalva que o prompt real exige ("não há dado
 * suficiente"), para que a simulação ensine o comportamento correto em vez de ensinar a inventar.
 */

import type { AiFunctionId } from '../../src/ai/contract';
import type { ProviderCall, ProviderResponse, ProviderAdapter } from './providers';

export interface SimulatedContext {
  readonly channelId: string;
  readonly channelName: string;
  readonly childDirected: boolean;
  readonly ageRange: string | null;
  readonly input: Readonly<Record<string, unknown>>;
  readonly note?: string | undefined;
}

/* --- Utilidades de leitura da entrada ---------------------------------------- */

function text(input: Readonly<Record<string, unknown>>, key: string, fallback = ''): string {
  const value = input[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function number(input: Readonly<Record<string, unknown>>, key: string, fallback: number): number {
  const value = input[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function list(input: Readonly<Record<string, unknown>>, key: string): string[] {
  const value = input[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

/* --- Geradores por função ---------------------------------------------------- */

/**
 * Cada gerador devolve um objeto que **precisa** passar no schema daquela função. Os testes de
 * `src/ai/__tests__/simulado.test.ts` rodam exatamente essa verificação para todas as funções — é o
 * que impede o simulado de virar a parte podre da base.
 */
const GENERATORS: Record<AiFunctionId, (context: SimulatedContext) => unknown> = {
  'pesquisar-tendencia': ({ input }) => {
    const niche = text(input, 'niche', 'o nicho do canal');
    const rejected = list(input, 'rejectedThemes');
    const candidates = [
      {
        tema: 'Cores que mudam com a luz',
        porQue: `Aproveita o que o canal já domina e usa ${niche} como cenário, sem repetir episódio.`,
        saturacao: 'baixa',
        oportunidade: 78,
        evidencia: 'sem dado no histórico do canal — sugestão de estrutura, não de desempenho',
      },
      {
        tema: 'Sons do jardim',
        porQue: 'Explora percepção sensorial, que costuma render repetição espontânea da criança.',
        saturacao: 'media',
        oportunidade: 66,
        evidencia: 'sem dado no histórico do canal — sugestão de estrutura, não de desempenho',
      },
      {
        tema: 'Um dia de cada personagem',
        porQue: 'Dá espaço aos personagens secundários e amplia o enredo sem criar personagem novo.',
        saturacao: 'baixa',
        oportunidade: 61,
        evidencia: 'sem dado no histórico do canal — sugestão de estrutura, não de desempenho',
      },
    ];
    const allowed = candidates.filter(
      (candidate) => !rejected.some((theme) => candidate.tema.toLowerCase() === theme.toLowerCase()),
    );
    // O schema exige no mínimo 3 temas: se o humano recusou algum, entram substitutos em vez de
    // devolver menos itens e quebrar o contrato.
    while (allowed.length < 3) {
      allowed.push({
        tema: `Tema alternativo ${allowed.length + 1}`,
        porQue: 'Alternativa gerada por não haver dado suficiente para ranquear com confiança.',
        saturacao: 'media',
        oportunidade: 55,
        evidencia: 'sem dado no histórico do canal — sugestão de estrutura, não de desempenho',
      });
    }
    return { temas: allowed.slice(0, 6) };
  },

  'planejar-pauta': ({ input }) => {
    const total = Math.min(Math.max(number(input, 'videosPorSemana', 4), 1), 14);
    const fortes = list(input, 'temasFortes');
    const niche = text(input, 'niche', 'o nicho do canal');
    const pauta = Array.from({ length: total }, (_, index) => {
      const isShort = index % 3 === 2;
      const tema = fortes[index % Math.max(fortes.length, 1)] ?? `${niche} — ângulo ${index + 1}`;
      return {
        dia: WEEKDAYS[index % WEEKDAYS.length] ?? 'Segunda',
        formato: isShort ? ('short' as const) : ('video' as const),
        tema,
        angulo: `Ângulo próprio para "${tema}", aproveitando o que já funcionou sem repetir o episódio.`,
        gancho: 'Abre com uma pergunta concreta e mostra a resposta antes do primeiro minuto.',
        duracaoSeg: isShort ? 45 : 300,
      };
    });
    return {
      resumo: `Semana com ${total} publicações: ${pauta.filter((item) => item.formato === 'video').length} vídeos longos e ${pauta.filter((item) => item.formato === 'short').length} Shorts, apoiados no que já funcionou no canal.`,
      pauta,
    };
  },

  'criar-roteiro': ({ input }) => {
    const total = number(input, 'duracaoSeg', 300);
    const characters = list(input, 'personagens');
    const protagonist = characters[0] ?? 'a personagem principal';
    const tema = text(input, 'tema', 'o tema do episódio');
    const blocos = Math.max(Math.min(Math.round(total / 60), 6), 3);
    const step = Math.round(total / blocos);
    return {
      titulo: `${tema}: uma descoberta em ${blocos} passos`,
      logline: `${protagonist} encontra algo inesperado e só entende o que aconteceu depois de tentar de novo.`,
      moral: 'Tentar de novo, com calma, resolve o que a pressa atrapalha.',
      blocos: Array.from({ length: blocos }, (_, index) => {
        const start = index * step;
        const end = index === blocos - 1 ? total : (index + 1) * step;
        const phase = index === 0 ? 'apresentação' : index === blocos - 1 ? 'resolução' : 'complicação';
        return {
          ordem: index + 1,
          tempoInicioSeg: start,
          tempoFimSeg: end,
          narracao: `[${phase}] ${protagonist} segue pelo cenário enquanto descobre o que o episódio quer mostrar.`,
          acao: `${protagonist} em cena, ação clara e contínua, sem corte brusco.`,
          emocao: index === blocos - 1 ? 'alívio' : 'curiosidade',
        };
      }),
    };
  },

  'criar-cena': ({ input }) => {
    const tema = text(input, 'tema', 'o episódio');
    const blocks = Array.isArray(input['blocos']) ? (input['blocos'] as unknown[]) : [];
    const count = Math.max(Math.min(blocks.length || 4, 60), 1);
    const characters = list(input, 'personagens');
    const protagonist = characters[0] ?? 'the main character';
    const style = text(input, 'estiloVisual', 'flat 2D animation for children, soft shapes');
    return {
      cenas: Array.from({ length: count }, (_, index) => ({
        numero: index + 1,
        duracaoSeg: index === count - 1 ? 12 : 15,
        descricao: `Cena ${index + 1} de ${tema}, com ${protagonist} em ação central e cenário coerente com o episódio.`,
        enquadramento: index === 0 ? 'plano geral' : index % 3 === 0 ? 'plano médio' : 'close',
        paleta: ['#F472B6', '#FBBF24', '#34D399'],
        promptImagem: `${protagonist}, consistent appearance, ${style}, scene ${index + 1}, centered composition, soft daylight, clean background, no text`,
        negativePrompt: 'deformed hands, extra limbs, text, watermark, logo, recognizable real person',
        seed: 1000 + index * 7,
      })),
    };
  },

  'criar-thumbnail': ({ input }) => {
    const titulo = text(input, 'titulo', 'o episódio');
    const base = [
      {
        id: 't1',
        label: 'Personagem em close',
        alt: 'Personagem principal em close, com expressão de surpresa, ocupando a maior parte da imagem.',
        conceito: 'Rosto grande e expressivo: é o que mais aparece no celular.',
        textoNaArte: 'Olha isso!',
        sugestao: true,
      },
      {
        id: 't2',
        label: 'Objeto em destaque',
        alt: 'Objeto central do episódio grande em primeiro plano, com o cenário desfocado ao fundo.',
        conceito: 'O destaque é o que o vídeo entrega, não o personagem.',
        textoNaArte: 'O que é?',
        sugestao: false,
      },
      {
        id: 't3',
        label: 'Antes e depois',
        alt: 'Imagem dividida ao meio mostrando o cenário antes e depois da transformação do episódio.',
        conceito: 'Contraste visual explica a proposta sem precisar de texto.',
        textoNaArte: 'Antes / depois',
        sugestao: false,
      },
      {
        id: 't4',
        label: 'Contagem',
        alt: 'Números grandes em sequência ao lado do personagem que aponta para eles.',
        conceito: 'Conteúdo educativo com número costuma render clique de quem busca aprender.',
        textoNaArte: '1, 2, 3',
        sugestao: false,
      },
    ];
    return {
      opcoes: base.map((option) => ({
        ...option,
        promptImagem: `${option.conceito} Ilustração do episódio "${titulo}", personagem consistente com o Character Sheet oficial, cores da paleta do canal, composição limpa, sem texto na imagem`,
      })),
    };
  },

  'criar-seo': ({ input }) => {
    const titulo = text(input, 'titulo', 'Episódio novo');
    const tema = text(input, 'tema', 'o tema');
    const canal = text(input, 'canalNome', 'o canal');
    return {
      titulo: titulo.slice(0, 100),
      descricao: `${titulo}\n\nNeste episódio, o canal ${canal} mostra ${tema} com uma história curta e clara, pensada para quem assiste aprender sem perceber que está aprendendo.\n\nAssista até o fim: a resolução depende do que acontece no último minuto.`,
      tags: [tema.toLowerCase(), 'educativo', 'infantil', 'história', 'aprender brincando'].slice(0, 5),
      hashtags: ['#educativo', '#infantil', '#historia'],
      capitulos: [
        { tempo: '00:00', rotulo: 'Começo' },
        { tempo: '01:00', rotulo: 'O problema' },
        { tempo: '03:00', rotulo: 'A solução' },
      ],
    };
  },

  'revisar-qualidade': ({ input, childDirected }) => {
    const titulo = text(input, 'titulo', 'o conteúdo');
    const idade = text(input, 'idadeAlvo', childDirected ? '3 a 5 anos' : 'público geral');
    return {
      veredito: 'precisa-ajuste',
      nota: 68,
      rubrica: { originalidade: 74, gancho: 62, clareza: 80, adequacaoEtaria: 58 },
      achados: [
        {
          gravidade: 'media',
          criterio: 'gancho',
          evidencia: `Em "${titulo}", a primeira frase descreve o cenário antes de apresentar o problema.`,
          sugestao: 'Começar pela pergunta que o episódio responde, e só depois situar o cenário.',
        },
        {
          gravidade: 'media',
          criterio: 'adequacaoEtaria',
          evidencia: `Há uma passagem longa sem mudança de ação para a faixa ${idade}.`,
          sugestao: 'Quebrar a passagem em dois blocos curtos, com ação visível em cada um.',
        },
      ],
    };
  },

  'revisar-infantil': ({ input, childDirected, ageRange }) => {
    const idade = text(input, 'idadeAlvo', ageRange ?? (childDirected ? '3 a 5 anos' : 'não informado'));
    return {
      adequado: true,
      bloqueante: false,
      faixaEtariaRecomendada: idade,
      ritmoSegPorCena: 15,
      vocabulario: [],
      valores: ['curiosidade', 'paciência'],
      achados: [
        {
          gravidade: 'baixa',
          criterio: 'ritmo',
          evidencia: 'Uma cena passa de 20 segundos sem mudança de ação.',
          sugestao: 'Cortar em duas para manter o ritmo da faixa.',
        },
      ],
    };
  },

  'agendar-horario': ({ input }) => {
    const historico = Array.isArray(input['historicoHorarios'])
      ? (input['historicoHorarios'] as unknown[])
      : [];
    const suficiente = historico.length >= 3;
    return {
      recomendacao: {
        diaSemana: 'Quinta',
        hora: '17:00',
        justificativa: suficiente
          ? `O histórico do canal tem ${historico.length} observações; a faixa da tarde aparece com a maior retenção entre elas.`
          : 'Não há dado suficiente no histórico do canal para sustentar uma recomendação — trate como ponto de partida e ajuste após medir.',
        confiancaPct: suficiente ? 65 : 25,
      },
      alternativas: suficiente
        ? [
            { diaSemana: 'Terça', hora: '18:00', justificativa: 'Segunda melhor faixa do histórico.' },
            { diaSemana: 'Sábado', hora: '10:00', justificativa: 'Bom desempenho em fim de semana.' },
          ]
        : [],
    };
  },

  'medir-analise': ({ input }) => {
    const views = number(input, 'views', 0);
    const receitaBrl = number(input, 'receitaBrl', 0);
    const custoUsd = number(input, 'custoUsd', 0);
    const cambio = number(input, 'cambioBrlPorUsd', 5.4);
    const media = (input['mediaCanal'] ?? {}) as Record<string, unknown>;
    const mediaViews = typeof media['views'] === 'number' ? media['views'] : 0;

    const receitaUsd = cambio > 0 ? receitaBrl / cambio : 0;
    const roi = custoUsd > 0 ? ((receitaUsd - custoUsd) / custoUsd) * 100 : 0;
    const comparacao = mediaViews > 0 ? ((views - mediaViews) / mediaViews) * 100 : 0;
    const semCusto = custoUsd <= 0;

    return {
      valeuAPena: semCusto || roi > 10 ? 'sim' : roi < -10 ? 'nao' : 'empate',
      roiPct: round(roi),
      comparacaoVsMediaPct: round(comparacao),
      leitura: semCusto
        ? `O desempenho em si é de ${views} visualizações, mas o custo deste conteúdo não foi registrado — sem custo não existe resposta para "valeu a pena?", porque a conta não fecha. Registre o custo real para que a comparação seja possível.`
        : `Receita de R$ ${round(receitaBrl)} equivale a US$ ${round(receitaUsd)} com o câmbio informado. Contra um custo de US$ ${round(custoUsd)}, o resultado é ${roi >= 0 ? 'positivo' : 'negativo'} em ${round(roi)}%. A comparação com a média do canal é de ${round(comparacao)}%.`,
      alertas: [
        ...(mediaViews <= 0 ? ['Não há média do canal para comparar — a comparação ficou em zero.'] : []),
        ...(semCusto ? ['Custo de produção não registrado: a pergunta central do negócio não pode ser respondida.'] : []),
      ].slice(0, 8),
    };
  },

  'aprender-insight': ({ input }) => {
    const itens = Array.isArray(input['itens']) ? (input['itens'] as unknown[]) : [];
    const rejeicoes = list(input, 'rejeicoes');
    const poucos = itens.length < 4;
    return {
      padroes: [
        {
          padrao: poucos
            ? 'Ainda não há itens suficientes para afirmar um padrão de desempenho com segurança.'
            : 'Os itens com mais retenção são os que têm ação visível desde os primeiros segundos.',
          forca: poucos ? 'fraca' : 'moderada',
          evidencia: poucos
            ? `A base tem ${itens.length} item(ns); abaixo de 4 não dá para separar sinal de coincidência.`
            : 'Comparação entre os itens do bloco que têm retenção acima e abaixo da mediana.',
          acao: 'Manter a abertura com ação concreta e medir de novo na próxima semana antes de generalizar.',
        },
      ],
      evitar: rejeicoes.slice(0, 10),
    };
  },

  'melhorar-plano': ({ input }) => {
    const rejeicoes = list(input, 'rejeicoes');
    const saturados = list(input, 'temasSaturados');
    const canal = text(input, 'canalNome', 'o canal');
    // A simulação aplica a mesma regra que o prompt real exige: o que o dono recusou e o que o dado
    // marcou como saturado não volta. Simular o contrário ensinaria o comportamento errado.
    const evitar = [...saturados, ...rejeicoes].slice(0, 5);
    return {
      mudancas: [
        {
          de: 'Abertura descrevendo o cenário antes do problema.',
          para: 'Abertura com a pergunta que o episódio responde.',
          porQue: 'Os itens com melhor retenção abrem com ação, não com descrição.',
        },
        {
          de: `Reaproveitar temas já usados por ${canal}.`,
          para: 'Ângulo novo sobre o que funcionou, sem repetir estrutura.',
          porQue: 'Variedade de enredo é requisito de elegibilidade de monetização, não preferência estética.',
        },
        ...(evitar.length > 0
          ? [
              {
                de: `Voltar a propor: ${evitar.join('; ')}.`,
                para: 'Fora da pauta até nova decisão sua.',
                porQue: 'Você recusou estes temas, ou o dado do canal os marcou como saturados.',
              },
            ]
          : []),
      ].slice(0, 10),
      proximaSemana: [
        { dia: 'Segunda', formato: 'video', tema: 'Tema forte com ângulo novo', angulo: 'Parte do que já funcionou e muda a estrutura da história.' },
        { dia: 'Quinta', formato: 'video', tema: 'Tema médio revisitado', angulo: 'Mesmo universo, conflito diferente.' },
        { dia: 'Sábado', formato: 'short', tema: 'Recorte curto do melhor momento', angulo: 'Uma ideia só, com gancho próprio.' },
      ],
      confiancaPct: 45,
    };
  },

  'identidade-personagem': ({ input }) => {
    const pedido = text(input, 'pedido', 'um personagem novo');
    return {
      nome: 'Bento',
      papel: 'Personagem de apoio, curioso e um pouco atrapalhado',
      descricaoVisual:
        'Personagem pequeno e arredondado, corpo branco, orelhas grandes e caídas, olhos redondos e escuros, sem coleira, patas curtas e cauda fina com a ponta escura. Expressão típica de curiosidade, cabeça levemente inclinada.',
      tracos: ['orelhas grandes e caídas', 'sem coleira', 'corpo branco arredondado', 'olhos redondos escuros', 'ponta da cauda escura'],
      promptImagem:
        'small rounded white cartoon character, large floppy ears, big round dark eyes, no collar, short legs, thin tail with dark tip, neutral background, full body, flat 2D children illustration, consistent design sheet',
      negativePrompt: 'collar, extra limbs, deformed paws, text, watermark, realistic photo, recognizable real person',
      seed: 4242,
      notasConsistencia: `Não alterar: tamanho das orelhas, ausência de coleira e cor do corpo. Manter a mesma paleta em toda cena; evitar sombra dura no rosto. Pedido de origem registrado para conferência: "${pedido.slice(0, 200)}".`,
    };
  },

  'monetizacao-veredito': ({ input }) => {
    const titulo = text(input, 'titulo', 'o conteúdo');
    const custo = number(input, 'custoProducaoUsd', 0);
    const receitaBrl = number(input, 'receitaBrl', 0);
    const views = number(input, 'views', 0);
    const cambio = number(input, 'cambioBrlPorUsd', 5.4);
    const receitaUsd = cambio > 0 ? receitaBrl / cambio : 0;
    const margem = receitaUsd - custo;
    const margemPct = custo > 0 ? (margem / custo) * 100 : 0;
    return {
      veredito: custo <= 0 ? 'empate' : margem > 0 ? 'valeu' : margem < 0 ? 'nao-valeu' : 'empate',
      margemUsd: round(margem),
      margemPct: round(margemPct),
      custoPorMilViewsUsd: views > 0 ? round((custo / views) * 1000) : 0,
      recomendacao:
        custo <= 0
          ? `O custo de produção de "${titulo}" não foi registrado, então a margem não pode ser calculada. Sem custo real, a pergunta "esse conteúdo valeu a pena?" fica sem resposta — registre o custo antes de decidir sobre o formato.`
          : `Com custo de US$ ${round(custo)} e receita de US$ ${round(receitaUsd)}, a margem é de US$ ${round(margem)}. ${margem > 0 ? 'O formato se paga; mantenha a faixa de custo.' : 'O formato não se paga no custo atual; reduza minutos gerados ou aumente o volume medido.'}`,
      riscos: [
        'A receita informada é estimativa do YouTube e pode ser revisada para menos.',
        ...(custo <= 0 ? ['Custo de produção ausente: a conclusão de margem não é confiável.'] : []),
        ...(views < 1000 ? ['Amostra pequena de visualizações: o custo por mil views é instável.'] : []),
      ].slice(0, 8),
    };
  },

  'marketing-derivados': ({ input }) => {
    const titulo = text(input, 'titulo', 'o episódio');
    const canal = text(input, 'canalNome', 'o canal');
    const personagem = text(input, 'personagem', 'o personagem principal');
    return {
      short: {
        gancho: `${personagem} encontra algo que não esperava.`,
        texto: `Trinta segundos do episódio "${titulo}": o momento em que tudo muda, sem contar o final.`,
      },
      instagram: {
        legenda: `Episódio novo no ${canal}: "${titulo}". A história completa está no YouTube — este é só o começo dela.`,
        hashtags: ['#animacao', '#conteudoinfantil', '#historia'],
      },
      tiktok: { texto: `O momento em que ${personagem} entende tudo. Episódio completo no canal.` },
      comunidadeYoutube: {
        texto: `Episódio novo no ar: "${titulo}". Qual parte você quer ver virar o próximo?`,
      },
      story: { texto: `Novo episódio: ${titulo}.` },
    };
  },
};

/**
 * Adaptador simulado.
 *
 * Recebe o mesmo `ProviderCall` que os provedores reais, mas o handler passa o contexto extra
 * separadamente — porque o simulado precisa da **entrada estruturada**, não do texto já montado.
 * Essa é a única costura entre o simulado e o pipeline real, e ela está explícita de propósito.
 */
export function simulate(functionId: AiFunctionId, context: SimulatedContext): ProviderResponse {
  const generator = GENERATORS[functionId];
  const data = generator(context);
  const raw = JSON.stringify(data);
  // Tokens contados de forma grosseira: ~4 caracteres por token. Serve para o teto diário do modo
  // simulado não ficar em zero, e é declarado aqui como aproximação — o número **real** vem do
  // `usage` do provedor e é o único que vai para o livro de custos.
  const tokensIn = Math.ceil((context.input ? JSON.stringify(context.input).length : 0) / 4);
  const tokensOut = Math.ceil(raw.length / 4);
  return { raw, tokensIn, tokensOut };
}

/**
 * O simulado também implementa a interface do provedor, para o caso de o handler querer tratá-lo de
 * forma uniforme. `complete` não é usado (o handler chama `simulate`, que tem a entrada estruturada),
 * e por isso lança: método que não deve ser chamado e devolve vazio é pior que método que falha alto.
 */
export const SIMULATED_PROVIDER: ProviderAdapter = {
  id: 'simulado',
  envVar: '',
  maxTokensParam: 'max_tokens',
  supportsJsonSchema: false,
  async complete(_call: ProviderCall): Promise<ProviderResponse> {
    throw new Error('O provedor simulado é chamado por simulate(), não por complete().');
  },
};

// rebeca-blueprint.js — Workflow da CADEIA A (fundação do produto).
//
// COMO USAR: este arquivo é o *script body* da ferramenta `workflow`.
// Passe o conteúdo deste arquivo no parâmetro `script` e o bloco `meta` abaixo no parâmetro `meta`.
//
// meta: {
//   name: 'rebeca-blueprint',
//   description: 'Gera o blueprint técnico da fundação do Rebeca com 9 especialistas em paralelo e uma síntese.',
//   whenToUse: 'Ao iniciar a fundação do produto ou ao revisar decisões de arquitetura.',
//   phases: [
//     { title: 'Blueprint' },
//     { title: 'Síntese' }
//   ]
// }
//
// args: { brief?: string, canais?: string[], modelos?: { [especialista]: { provider, model } } }

const RAIZ = 'E:\\pojeto rebeca';

const contexto = `
Você é um especialista da orquestra de agentes do projeto Rebeca (${RAIZ}).

ANTES DE RESPONDER, faça nesta ordem:
1. Leia ${RAIZ}\\docs\\00-visao-produto.md (fonte de verdade do produto).
2. Leia ${RAIZ}\\docs\\01-orquestra-de-agentes.md (roster, handoffs, Definition of Done).
3. Carregue a SUA skill com a ferramenta skill (o id está no seu foco abaixo) e siga o checklist dela.
4. Leia ${RAIZ}\\.rebeca\\estado.md para saber a fase atual e as decisões pendentes.

REGRAS INEGOCIÁVEIS:
- Nada de fato externo inventado (endpoint, quota, preço, limite de API). Sem fonte verificável,
  escreva "NÃO VERIFICADO" e diga como verificar. Use web_search quando precisar de fonte.
- Multi-canal desde o design: tudo escopado por canal. Aprovação humana antes de publicar.
- Toda entrega precisa de evidência executável, não de afirmação.
- Responda em português do Brasil.
`;

const ESQUEMA_PARECER = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'resumo', 'decisoes', 'entregaveis', 'riscos', 'perguntas_humanas'],
  properties: {
    status: { type: 'string', enum: ['concluido', 'parcial', 'bloqueado'] },
    resumo: { type: 'string' },
    decisoes: { type: 'array', items: { type: 'string' } },
    entregaveis: { type: 'array', items: { type: 'string' } },
    riscos: { type: 'array', items: { type: 'string' } },
    perguntas_humanas: { type: 'array', items: { type: 'string' } },
  },
};

const brief =
  args.brief ||
  'Definir o blueprint técnico da fundação do Rebeca: arquitetura, dados, backend, front, ' +
    'produção de mídia, integração com YouTube, conformidade e caminho de entrega.';

const canais = args.canais || ['Luna e o Jardim das Cores', 'Arquivo Curioso', 'AI Made Simple'];
const modelos = args.modelos || {};

const especialistas = [
  { id: 'rebeca-produto', foco: 'Roadmap, MVP x depois, histórias com critérios de aceite, e a métrica "esse conteúdo valeu a pena?".' },
  { id: 'rebeca-arquiteto', foco: 'Arquitetura de módulos, máquina de estados do ciclo de 10 etapas, isolamento multi-canal, abstração de provedores de IA. Produza ADRs.' },
  { id: 'rebeca-supabase', foco: 'Modelo de dados multi-canal com RLS, Auth com OAuth do Google, Storage escopado por canal, migrations e como testar RLS.' },
  { id: 'rebeca-backend', foco: 'APIs, fila de jobs longos de geração, idempotência, retry, webhooks e registro de custo real por ativo.' },
  { id: 'rebeca-react', foco: 'Front-end: seletor de canal que troca todo o contexto, tela de revisão/aprovação, calendário e analytics. Simplicidade para o usuário.' },
  { id: 'rebeca-pwa', foco: 'PWA no celular: manifest, service worker, fila de aprovação offline, push de "conteúdos aguardando aprovação" e o que nunca pode ser cacheado.' },
  { id: 'rebeca-ia-video', foco: 'Pipeline de mídia (roteiro→imagem→voz→música→render→Short), consistência de personagem, formatos de saída e custo por minuto.' },
  { id: 'rebeca-youtube', foco: 'Integração oficial: OAuth com escopo mínimo, upload resumível, agendamento, metadados, quotas e a regra de aprovação humana obrigatória.' },
  { id: 'rebeca-infantil', foco: 'Adequação do canal infantil "Luna e o Jardim das Cores": faixa etária, estrutura narrativa, valores, linguagem e poder de veto sobre conteúdo inadequado.' },
  { id: 'rebeca-lgpd', foco: 'LGPD e ECA Digital aplicadas: base legal por dado tratado, consentimento, menores, retenção, DPA dos provedores de IA e o que exige revisão jurídica.' },
  { id: 'rebeca-seguranca', foco: 'Threat model com foco no token OAuth do YouTube, segredos, injeção de prompt vindo de conteúdo externo e prova de não vazamento entre canais.' },
];

phase('Blueprint');
log(`Blueprint do Rebeca — ${especialistas.length} especialistas, canais: ${canais.join(', ')}`);

const pareceres = await parallel(
  especialistas.map((esp) => async () => {
    const alvo = modelos[esp.id] || {};
    const texto = await agent(
      `${contexto}

Você é o agente \`${esp.id}\` (carregue essa skill antes de responder).

BRIEF DO DONO DO PRODUTO:
${brief}

CANAIS ENVOLVIDOS: ${canais.join(', ')}

SEU FOCO NESTA RODADA:
${esp.foco}

Entregue um parecer técnico curto e decisivo (não um ensaio): as escolhas que você faria, com o
motivo e a alternativa descartada; os artefatos concretos que você produziria (com caminho no
repositório); o que precisa ser decidido por um humano; e o que você NÃO conseguiu verificar.`,
      {
        label: esp.id,
        phase: 'Blueprint',
        ...(alvo.provider ? { provider: alvo.provider } : {}),
        ...(alvo.model ? { model: alvo.model } : {}),
        schema: ESQUEMA_PARECER,
      },
    );
    log(`${esp.id}: ${texto ? texto.status : 'falhou'}`);
    return { id: esp.id, parecer: texto };
  }),
);

const validos = pareceres.filter(Boolean).filter((p) => p.parecer);
const falharam = especialistas.map((e) => e.id).filter((id) => !validos.some((v) => v.id === id));

phase('Síntese');

const dossie = validos
  .map((v) => `## ${v.id}\n${JSON.stringify(v.parecer, null, 2)}`)
  .join('\n\n');

const sintese = await agent(
  `${contexto}

Você é o agente \`rebeca-orquestrador\`. Recebeu os pareceres abaixo de ${validos.length} especialistas.

${dossie}

Produza o BLUEPRINT CONSOLIDADO da fundação do Rebeca, em markdown, com estas seções:
1. Decisão de arquitetura proposta (com o porquê e a alternativa descartada).
2. Stack e módulos, com fronteiras entre eles.
3. Modelo de dados mínimo multi-canal (tabelas e o que isola o canal).
4. Caminho crítico da fundação, em ordem, com o agente responsável por cada passo.
5. Riscos e o que ainda não foi verificado.
6. Decisões que EXIGEM aprovação humana, numeradas, cada uma com as opções e sua recomendação.
7. Conflitos entre especialistas, se houver, e como você arbitrou.

Se houver conflito real entre dois pareceres, registre-o explicitamente em vez de esconder.
Responda em português do Brasil.`,
  { label: 'rebeca-orquestrador', phase: 'Síntese' },
);

return {
  brief,
  canais,
  especialistas_ok: validos.map((v) => v.id),
  especialistas_falharam: falharam,
  pareceres: validos,
  blueprint: sintese,
  aviso: 'Nada aqui autoriza escrever código de produção nem publicar conteúdo: as decisões humanas listadas na seção 6 precisam de aprovação antes.',
};

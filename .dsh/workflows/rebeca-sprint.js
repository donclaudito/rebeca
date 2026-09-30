// rebeca-sprint.js — Workflow da CADEIA C / implementação de uma história.
//
// COMO USAR: este arquivo é o *script body* da ferramenta `workflow`.
//
// meta: {
//   name: 'rebeca-sprint',
//   description: 'Implementa uma história com contrato, código, revisão adversarial e correção até passar.',
//   whenToUse: 'Quando houver uma história com critério de aceite e for hora de escrever código de verdade.',
//   phases: [
//     { title: 'Contrato' },
//     { title: 'Implementação' },
//     { title: 'Revisão adversarial' },
//     { title: 'Correção e verificação' }
//   ]
// }
//
// args: {
//   historia: string,      // história com critério de aceite verificável (obrigatório)
//   agente: string,        // id do especialista dono da implementação, ex.: 'rebeca-supabase'
//   arquivos?: string[],   // caminhos que a mudança pode tocar (limita o escopo)
//   tentativas?: number    // quantas rodadas de correção no máximo (padrão 2)
// }

const RAIZ = 'E:\\pojeto rebeca';

const historia = args.historia;
const dono = args.agente || 'rebeca-backend';
const arquivos = args.arquivos || [];
const maxTentativas = args.tentativas || 2;

if (!historia) {
  return { erro: 'Faltou args.historia: descreva a história e o critério de aceite verificável.' };
}

const base = `
Projeto Rebeca (${RAIZ}). Leia ${RAIZ}\\docs\\00-visao-produto.md, ${RAIZ}\\.rebeca\\estado.md e
carregue a SUA skill antes de agir. Responda em português do Brasil.

Regras: evidência executável (comando + saída observada), nunca afirmação; nada de fato externo
inventado; segredo nunca em texto claro; isolamento entre canais preservado; custo registrado quando
houver geração paga. Não publique nada e não faça commit sem pedido explícito.
`;

const ESQUEMA_CONTRATO = {
  type: 'object',
  additionalProperties: false,
  required: ['entendimento', 'arquivos_afetados', 'interfaces', 'riscos', 'criterios_de_aceite'],
  properties: {
    entendimento: { type: 'string' },
    arquivos_afetados: { type: 'array', items: { type: 'string' } },
    interfaces: { type: 'array', items: { type: 'string' } },
    riscos: { type: 'array', items: { type: 'string' } },
    criterios_de_aceite: { type: 'array', items: { type: 'string' } },
  },
};

const ESQUEMA_REVISAO = {
  type: 'object',
  additionalProperties: false,
  required: ['aprovado', 'defeitos', 'evidencia_verificada', 'nao_verificado', 'veredito'],
  properties: {
    aprovado: { type: 'boolean' },
    defeitos: { type: 'array', items: { type: 'string' } },
    evidencia_verificada: { type: 'array', items: { type: 'string' } },
    nao_verificado: { type: 'array', items: { type: 'string' } },
    veredito: { type: 'string' },
  },
};

const ESQUEMA_IMPLEMENTACAO = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'arquivos_criados', 'comandos_executados', 'resultado', 'pendencias'],
  properties: {
    status: { type: 'string', enum: ['concluido', 'parcial', 'bloqueado'] },
    arquivos_criados: { type: 'array', items: { type: 'string' } },
    comandos_executados: { type: 'array', items: { type: 'string' } },
    resultado: { type: 'string' },
    pendencias: { type: 'array', items: { type: 'string' } },
  },
};

phase('Contrato');

const contrato = await agent(
  `${base}

Você é o agente \`rebeca-arquiteto\`.

HISTÓRIA A IMPLEMENTAR:
${historia}

ESPECIALISTA QUE VAI IMPLEMENTAR: ${dono}
${arquivos.length ? `ARQUIVOS PERMITIDOS: ${arquivos.join(', ')}` : 'ARQUIVOS: ainda não definidos — proponha o conjunto mínimo.'}

Antes de qualquer código: escreva o contrato da mudança. Se a história estiver ambígua, diga o que
assumiu em vez de inventar requisito. Se a mudança exigir decisão de arquitetura com trade-off,
aponte que precisa de ADR em .rebeca/decisoes/.`,
  { label: 'rebeca-arquiteto:contrato', phase: 'Contrato', schema: ESQUEMA_CONTRATO },
);

log(`Contrato: ${contrato ? contrato.criterios_de_aceite.length : 0} critério(s) de aceite`);

phase('Implementação');

let entrega = await agent(
  `${base}

Você é o agente \`${dono}\`.

HISTÓRIA:
${historia}

CONTRATO APROVADO PELO ARQUITETO (JSON):
${JSON.stringify(contrato, null, 2)}

Implemente com a MENOR mudança que satisfaz os critérios de aceite. Escreva os arquivos de verdade
no repositório (ferramentas write/edit), execute os comandos necessários e cole a evidência real
(saída observada, não a esperada). Se algo não puder ser feito, marque o status e explique.`,
  { label: `${dono}:implementacao`, phase: 'Implementação', schema: ESQUEMA_IMPLEMENTACAO },
);

let revisao = null;
let tentativa = 0;

while (true) {
  phase('Revisão adversarial');
  revisao = await agent(
    `${base}

Você é o agente \`rebeca-qa\`. Quem produziu NÃO aprova o próprio trabalho — você tenta REFUTAR.

HISTÓRIA E CRITÉRIOS DE ACEITE:
${JSON.stringify(contrato ? contrato.criterios_de_aceite : [], null, 2)}

O QUE FOI ENTREGUE (JSON):
${JSON.stringify(entrega, null, 2)}

Faça a verificação de verdade no repositório: leia os arquivos, execute os comandos, rode os testes,
tente quebrar (entrada vazia, canal errado, repetição/retry, dado de outro canal, limite de custo).
Aprove SÓ se houver evidência observada por você. Liste separadamente o que você não conseguiu
verificar.`,
    { label: 'rebeca-qa:revisao', phase: 'Revisão adversarial', schema: ESQUEMA_REVISAO },
  );

  if (!revisao || revisao.aprovado || tentativa >= maxTentativas) break;

  tentativa += 1;
  phase('Correção e verificação');
  log(`Revisão reprovou (${revisao.defeitos.length} defeito(s)) — correção ${tentativa}/${maxTentativas}`);

  entrega = await agent(
    `${base}

Você é o agente \`${dono}\`. Sua entrega anterior foi REPROVADA pela revisão adversarial.

DEFEITOS APONTADOS PELO rebeca-qa:
${JSON.stringify(revisao.defeitos, null, 2)}

O QUE NÃO FOI VERIFICADO:
${JSON.stringify(revisao.nao_verificado, null, 2)}

Corrija exatamente esses defeitos (não refaça o que estava certo), execute novamente e traga a
evidência. Se discordar de um defeito, diga por quê com evidência em vez de ignorar.`,
    { label: `${dono}:correcao-${tentativa}`, phase: 'Correção e verificação', schema: ESQUEMA_IMPLEMENTACAO },
  );
}

phase('Correção e verificação');

const encerramento = await agent(
  `${base}

Você é o agente \`rebeca-orquestrador\`. Feche esta história.

HISTÓRIA: ${historia}
CONTRATO: ${JSON.stringify(contrato, null, 2)}
ENTREGA FINAL: ${JSON.stringify(entrega, null, 2)}
REVISÃO FINAL: ${JSON.stringify(revisao, null, 2)}

Escreva o fechamento: o que ficou pronto, o que ficou pendente, qual ADR precisa ser criado, qual
linha deve ser atualizada em .rebeca/estado.md, e o próximo agente. Não declare pronto o que a
revisão não aprovou.`,
  { label: 'rebeca-orquestrador:fechamento', phase: 'Correção e verificação' },
);

return {
  historia,
  dono,
  rodadas_de_correcao: tentativa,
  contrato,
  entrega_final: entrega,
  revisao_final: revisao,
  aprovado_pelo_qa: Boolean(revisao && revisao.aprovado),
  fechamento: encerramento,
};

// rebeca-episodio.js — Workflow do CICLO DE PRODUÇÃO (cadeia B).
//
// COMO USAR: este arquivo é o *script body* da ferramenta `workflow`.
//
// meta: {
//   name: 'rebeca-episodio',
//   description: 'Produz o pacote completo de um episódio: adequação infantil, roteiro, visual, plano de mídia, SEO e revisão adversarial.',
//   whenToUse: 'Quando o usuário pedir conteúdo novo para um canal (ex.: um episódio da Luna).',
//   phases: [
//     { title: 'Pauta' },
//     { title: 'Produção' },
//     { title: 'Verificação' }
//   ]
// }
//
// args: {
//   canal: string,            // ex.: 'Luna e o Jardim das Cores'
//   pautas: string[],         // uma ou mais ideias de conteúdo
//   faixaEtaria?: string,     // ex.: '3 a 5 anos'
//   formato?: 'longo' | 'short' | 'ambos'
// }
//
// IMPORTANTE: este workflow NÃO publica nada. Ele termina em "pronto para aprovação humana".
// A publicação exige aprovação explícita registrada em .rebeca/estado.md (ferramenta rebeca-youtube).

const RAIZ = 'E:\\pojeto rebeca';

const canal = args.canal || 'Luna e o Jardim das Cores';
const pautas = args.pautas && args.pautas.length ? args.pautas : ['Luna e as Borboletas Coloridas'];
const faixaEtaria = args.faixaEtaria || '3 a 5 anos';
const formato = args.formato || 'ambos';

const base = `
Você trabalha no projeto Rebeca (${RAIZ}), na produção de conteúdo do canal "${canal}".
Leia ${RAIZ}\\docs\\00-visao-produto.md e carregue a SUA skill antes de responder.
Canal, faixa etária e formato fazem parte do escopo: nada pode vazar de um canal para outro.
Nunca invente fato externo (quota, preço, limite de API); sem fonte, escreva "NÃO VERIFICADO".
Registre custo real ou estimado de toda geração paga. Responda em português do Brasil.
`;

const ESQUEMA_ETAPA = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'resumo', 'artefatos', 'bloqueio'],
  properties: {
    ok: { type: 'boolean' },
    resumo: { type: 'string' },
    artefatos: { type: 'array', items: { type: 'string' } },
    bloqueio: { type: 'string' },
  },
};

// Uma etapa: recebe o acumulado das anteriores e devolve o acumulado + a sua contribuição.
async function etapa(agente, foco, prev, item) {
  const anterior = prev ? JSON.stringify(prev).slice(0, 6000) : '(primeira etapa)';
  const r = await agent(
    `${base}

Você é o agente \`${agente}\`.

CONTEÚDO: "${item}"
FAIXA ETÁRIA: ${faixaEtaria}
FORMATO: ${formato}

TRABALHO JÁ FEITO PELAS ETAPAS ANTERIORES (JSON):
${anterior}

SUA TAREFA NESTA ETAPA:
${foco}

Se o trabalho anterior tiver um defeito que impede a sua etapa, NÃO conserte silenciosamente: marque
ok=false e descreva o bloqueio. Se algo estiver fora da faixa etária ou inadequado para crianças,
bloqueie e explique.`,
    { label: `${agente}:${item}`, phase: 'Produção', schema: ESQUEMA_ETAPA },
  );
  return { etapa: agente, resultado: r, anterior: prev };
}

phase('Pauta');
log(`Canal ${canal} — ${pautas.length} pauta(s), faixa ${faixaEtaria}, formato ${formato}`);

const resultados = await pipeline(
  pautas,

  // 1. Adequação pedagógica — pode VETAR o conteúdo.
  (prev, item) =>
    etapa(
      'rebeca-infantil',
      'Valide a pauta para a faixa etária: tema, valores, ausência de medo/violência/estereótipo, ' +
        'duração e ritmo adequados, vocabulário. Entregue a estrutura narrativa recomendada e a ' +
        'checagem de adequação. Você tem poder de veto: se a pauta não serve para a faixa, bloqueie.',
      prev,
      item,
    ),

  // 2. Roteiro.
  (prev, item) =>
    etapa(
      'rebeca-prompt-eng',
      'Transforme a pauta aprovada pela etapa anterior em roteiro de produção cena a cena, com ' +
        'falas, ação visual, duração por cena e descrição de cada imagem necessária. Use prompt ' +
        'versionado (.rebeca/prompts/) e diga qual versão usou. Entregue também o título candidato ' +
        'e a descrição.',
      prev,
      item,
    ),

  // 3. Identidade visual e consistência de personagem.
  (prev, item) =>
    etapa(
      'rebeca-branding',
      'Garanta consistência de personagem e marca: descreva como cada personagem deve aparecer ' +
        '(Character Sheet, traços que nunca mudam, paleta), o estilo visual das cenas e o briefing ' +
        'de 3 a 4 opções de thumbnail legíveis em tela pequena. Registre os assets com caminho e versão.',
      prev,
      item,
    ),

  // 4. Plano de produção de mídia.
  (prev, item) =>
    etapa(
      'rebeca-ia-video',
      'Monte o plano de produção de mídia: imagens, animação, voz, música, montagem e render ' +
        '(ffmpeg), formatos de saída (16:9 longo e 9:16 Short), com custo estimado por ativo e o ' +
        'registro a ser feito em .rebeca/custos.csv. Aponte o que é reexecutável sem pagar duas vezes.',
      prev,
      item,
    ),

  // 5. Publicação: metadados, SEO e agendamento (sem publicar).
  (prev, item) =>
    etapa(
      'rebeca-youtube',
      'Prepare a publicação SEM publicar: título, descrição, tags, categoria, idioma, playlist, ' +
        'público e as configurações obrigatórias do YouTube, além do agendamento sugerido (data e ' +
        'horário com justificativa). Liste os campos que o usuário precisa conferir na aprovação.',
      prev,
      item,
    ),

  // 6. Verificação adversarial.
  (prev, item) =>
    etapa(
      'rebeca-qa',
      'Tente REFUTAR este pacote. Verifique critério por critério: a história respeita a faixa ' +
        'etária? há erro factual ou inconsistência de personagem entre cenas? o título/thumbnail ' +
        'promete o que o vídeo entrega (clickbait enganoso)? o custo estimado é plausível? existe ' +
        'risco de publicar duplicado ou de vazar dado de outro canal? Reporte os defeitos com a ' +
        'correção mínima necessária e diga o que NÃO conseguiu verificar.',
      prev,
      item,
    ),

  // 7. Conformidade e proteção de menores.
  (prev, item) =>
    etapa(
      'rebeca-lgpd',
      'Checagem final de conformidade: o conteúdo usa dado pessoal de criança (nome, imagem, voz)? ' +
        'há coleta de dado de audiência? o material se enquadra como conteúdo para crianças nas ' +
        'políticas aplicáveis? o que precisa de revisão jurídica humana antes de ir ao ar? ' +
        'Bloqueie se houver risco a menor.',
      prev,
      item,
    ),
);

phase('Verificação');

const linhas = resultados.filter(Boolean);
const bloqueados = linhas.filter((l) => {
  const ultimo = l && l.resultado;
  return !ultimo || ultimo.ok === false;
});

const dossie = linhas
  .map((l) => `## ${l.etapa}\n${JSON.stringify(l.resultado, null, 2)}`)
  .join('\n\n');

const parecerFinal = await agent(
  `${base}

Você é o agente \`rebeca-orquestrador\`. Abaixo está o pacote produzido pela cadeia para cada pauta.

${dossie}

Monte o RESUMO DE APROVAÇÃO para o usuário (que é o editor-chefe e não quer ler detalhe técnico):
para cada conteúdo, em no máximo 10 linhas — o que é, duração, título proposto, o que a IA decidiu
sozinha, o que só o humano pode decidir, e a lista de pendências que impedem a publicação.
Termine com "APROVAÇÃO NECESSÁRIA" e o que exatamente o humano deve responder.
Não aprove nada em nome dele.`,
  { label: 'rebeca-orquestrador', phase: 'Verificação' },
);

return {
  canal,
  faixaEtaria,
  formato,
  conteudos: linhas.map((l) => ({ etapa: l.etapa, resultado: l.resultado })),
  bloqueados: bloqueados.length,
  resumo_para_aprovacao: parecerFinal,
  estado: bloqueados.length
    ? 'BLOQUEADO — há etapa reprovada; resolver antes de pedir aprovação'
    : 'PRONTO PARA APROVAÇÃO HUMANA — nada foi publicado',
};

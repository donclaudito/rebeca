/**
 * Registro de canais do lado do servidor.
 *
 * Existe por uma razão de segurança, não de conveniência: a skill `rebeca-seguranca` lista como
 * anti-padrão **"confiar em `channel_id` vindo do cliente"**. Aqui o `channelId` que chega no corpo
 * da requisição é conferido contra esta lista antes de qualquer coisa acontecer — canal que não
 * existe é recusado, e o servidor é quem decide se o canal é dirigido a crianças.
 *
 * Por que isso importa agora, mesmo sem login: a restrição de fornecedor **depende do canal**. O
 * `ADR-005` fixou que a allow-list de provedor é por canal (canal infantil pode usar fornecedor que
 * o canal adulto não pode, e vice-versa), e a pesquisa dos provedores de LLM
 * (`.rebeca/pesquisa/llm-spec-openai-deepseek.md`) encontrou cláusula contratual que pode vedar
 * conteúdo que "apresenta uma persona de pessoa menor de 18 anos" — exatamente o caso da Luna. Se o
 * cliente pudesse dizer de qual canal se trata sem conferência, o gate seria decorativo.
 *
 * LIMITE DECLARADO: isto **não é autorização**. Não há autenticação nesta fase; quem alcança a
 * função serverless pode chamar qualquer canal desta lista. Autorização real exige Auth + RLS, que é
 * a decisão D3 (ainda aberta). Este arquivo garante integridade de escopo, não controle de acesso —
 * e a diferença entre as duas coisas está escrita aqui de propósito.
 */

export interface ServerChannel {
  readonly id: string;
  readonly name: string;
  readonly niche: string;
  /**
   * `true` quando o conteúdo do canal é dirigido a crianças. Decisão do **servidor**; o cliente não
   * opina. Aciona o gate de canal infantil e restringe a allow-list de provedor.
   */
  readonly childDirected: boolean;
  /** Faixa etária declarada, quando infantil. Entra no contexto de revisão. */
  readonly ageRange: string | null;
}

/**
 * Espelha os canais semeados em `src/data/mock/db.ts`.
 *
 * Quando o Supabase entrar (D1), esta lista passa a ser a tabela `channels` lida pela função — o
 * resto do código não muda, porque ninguém consulta este módulo diretamente além do handler.
 */
export const SERVER_CHANNELS: readonly ServerChannel[] = [
  {
    id: 'luna',
    name: 'Luna e o Jardim das Cores',
    niche: 'Animação educativa para crianças de 3 a 5 anos',
    childDirected: true,
    ageRange: '3 a 5 anos',
  },
  {
    id: 'arquivo',
    name: 'Arquivo Curioso',
    niche: 'Ciência e curiosidades em formato longo',
    childDirected: false,
    ageRange: null,
  },
  {
    id: 'aims',
    name: 'AI Made Simple',
    niche: 'Inteligência artificial explicada para não especialistas',
    childDirected: false,
    ageRange: null,
  },
];

export function findServerChannel(channelId: unknown): ServerChannel | null {
  if (typeof channelId !== 'string' || channelId.trim().length === 0) return null;
  return SERVER_CHANNELS.find((channel) => channel.id === channelId) ?? null;
}

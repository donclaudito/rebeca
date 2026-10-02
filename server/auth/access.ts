/**
 * Lista de acesso — **quem** pode usar as rotas que gastam dinheiro.
 *
 * O `ADR-014` decidiu que a identidade é o **`sub`** do Google, não o e-mail. O motivo é literal da
 * documentação oficial: uma conta Google pode ter e-mails diferentes ao longo do tempo, e o `sub` é
 * único entre todas as contas e nunca reutilizado. Autorizar por e-mail daria acesso indevido no dia
 * em que o endereço mudasse de dono.
 *
 * Consequência prática: a lista vive numa variável de ambiente **do servidor**
 * (`REBECA_ALLOWED_SUBS`) e nunca chega ao navegador — nem a lista, nem a contagem (a contagem saiu da
 * rota pública depois do `QA-014`; ela só aparece em `/api/auth/me`, depois de o token ser
 * verificado).
 *
 * Formato aceito: `sub`s separados por vírgula, ponto e vírgula ou espaço em branco. Aceitar os três
 * não é generosidade: quem cola a variável no painel da Vercel raramente acerta o mesmo separador duas
 * vezes, e um separador errado derrubaria o acesso de todo mundo em silêncio.
 */

import { valorDoEnvDeDesenvolvimento } from '../dev-env.js';

/** Separadores aceitos entre `sub`s. */
const SEPARADORES = /[\s,;]+/;

/**
 * Caracteres que **não se veem** e que estragam comparação de identificador.
 *
 * Espaços de todos os tipos, espaço não separável (`\u00a0`), largura zero (`\u200b`), marcas de
 * direção (`\u200e`/`\u200f`), separadores de linha/parágrafo (`\u2028`/`\u2029`), espaço estreito
 * (`\u202f`), ideográfico (`\u3000`) e a marca de ordem de bytes (`\ufeff`).
 *
 * Existe por um sintoma medido, não por precaução genérica: o dono do produto viu a tela recusar a
 * conta **com o `sub` certo na mão**, enquanto o servidor imprimia a lista contendo exatamente aquele
 * texto. Duas strings iguais não falham em `Set.has` — logo o texto que chega do Google **não** é
 * igual ao que se lê na tela, e a diferença só pode estar em caractere invisível (colar um `sub` de
 * um log, de um PDF ou de uma captura de tela é o caminho por onde esse lixo entra).
 *
 * Isto **não** afrouxa a autorização: a identidade continua sendo comparada inteira com a lista, e um
 * `sub` forjado não passa porque o token é assinado pelo Google — o que muda é que lixo invisível
 * deixa de ser motivo de recusa.
 */
const INVISIVEIS = /[\s\u00a0\u1680\u2000-\u200f\u2028\u2029\u202f\u205f\u3000\ufeff]/g;

/** Remove caracteres invisíveis de um identificador. Exportada para o diagnóstico do servidor de dev. */
export function limparIdentificador(valor: string): string {
  return valor.replace(INVISIVEIS, '');
}

/** Entradas da lista que **não são** `sub`.
 *
 * Um `sub` do Google é uma sequência de dígitos (por volta de 21). Um e-mail na lista é o erro
 * provável de quem leu o runbook pela metade: a lista fica preenchida, o login funciona, e **toda**
 * chamada devolve 403 sem que a causa seja óbvia. Detectar isso permite a mensagem de recusa dizer o
 * que está errado em vez de "conta não autorizada".
 */
export function entradasQueNaoSaoSub(entradas: ReadonlySet<string>): readonly string[] {
  return [...entradas].filter((entrada) => !/^\d{6,}$/.test(entrada));
}

/** Lê a lista do ambiente. Valor ausente, vazio ou só com separadores devolve conjunto vazio. */
export function allowedSubs(env: NodeJS.ProcessEnv = process.env): ReadonlySet<string> {
  /*
   * Em **desenvolvimento** o valor vem do `.env` lido na hora (`server/dev-env.ts`): sem isso, editar
   * a lista e recarregar a página não mudava nada — e o sintoma na tela era "conta não autorizada" com
   * o `sub` certo na mão. O arquivo só é consultado quando o ambiente lido é o **do processo**; um
   * ambiente injetado (testes) manda sozinho.
   */
  const doArquivo = env === process.env ? valorDoEnvDeDesenvolvimento('REBECA_ALLOWED_SUBS') : null;
  const raw = doArquivo ?? env['REBECA_ALLOWED_SUBS'] ?? '';
  return new Set(
    raw
      .split(SEPARADORES)
      .map((parte) => limparIdentificador(parte.trim()))
      .filter((parte) => parte.length > 0),
  );
}

/**
 * `true` quando o `sub` está na lista.
 *
 * A comparação é feita **dos dois lados sem caracteres invisíveis** (`limparIdentificador`), porque o
 * identificador que chega do Google e o que está configurado podem carregar lixo invisível — e o
 * sintoma disso é a tela recusando a conta com o `sub` aparentemente correto. Fora isso, a comparação
 * é exata: continua sendo a identidade inteira contra a lista, e um `sub` que não esteja lá é recusado.
 */
export function isSubAllowed(sub: string, allowed: ReadonlySet<string> = allowedSubs()): boolean {
  if (allowed.has(sub)) return true;
  const limpo = limparIdentificador(sub);
  return limpo !== sub && allowed.has(limpo);
}

/**
 * Ponte com o **Google Identity Services** — o botão "Entrar com o Google".
 *
 * Três decisões que a documentação oficial obriga, e que estão aqui para não serem redescobertas:
 *
 * 1. **A biblioteca vem de `https://accounts.google.com/gsi/client`, sempre.** A doc é literal:
 *    "self-hosting or using an offline copy is not a supported use case and may lead to unexpected
 *    behavior or future integration failures". Um endereço configurável aqui seria a porta pela qual
 *    alguém serviria uma cópia — por isso a URL é constante (`contract.ts`, `GOOGLE_SCRIPT_URL`), e
 *    não parâmetro.
 * 2. **O carregamento é idempotente.** O React monta, desmonta e remonta componentes; injetar o
 *    `<script>` a cada remontagem faria o navegador baixar a biblioteca várias vezes e, pior,
 *    reexecutar `initialize` no meio de um login em andamento.
 * 3. **Falha de carregamento diz o que provavelmente é.** A causa mais comum disso em app publicado é
 *    o CSP não autorizar `accounts.google.com` — o sintoma no navegador é o botão simplesmente não
 *    existir, sem nenhuma mensagem na tela. Aqui a mensagem existe.
 *
 * O que vem no callback é o **ID token** (um JWT). Ele é guardado em memória por `token.ts` e
 * enviado como `Authorization: Bearer …`. O conteúdo do JWT **não** é usado para decidir nada: quem
 * decide é o servidor, que verifica a assinatura. Decodificar aqui é apresentação, não autorização.
 */

import { GOOGLE_SCRIPT_URL } from './contract';

/** Resposta do callback do Google. `credential` é o ID token. */
interface GoogleCredentialResponse {
  readonly credential?: string;
}

interface GoogleButtonOptions {
  readonly theme?: 'outline' | 'filled_blue' | 'filled_black';
  readonly size?: 'large' | 'medium' | 'small';
  readonly text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  readonly shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  readonly locale?: string;
  readonly width?: number;
  /**
   * Chamado quando o usuário **clica** no botão (opção documentada: `click_listener`).
   *
   * Existe porque o modo de falha que travou o dono é **silencioso**: o clique acontece, o pop-up não
   * abre (bloqueio do navegador, FedCM indisponível) e a tela não diz nada — sem mensagem, sem erro em
   * lugar nenhum que a pessoa veja. Com o clique observado, a tela pode dizer o que fazer depois de
   * alguns segundos sem credencial.
   */
  readonly click_listener?: () => void;
}

interface GoogleIdApi {
  initialize(config: {
    readonly client_id: string;
    readonly callback: (response: GoogleCredentialResponse) => void;
    readonly auto_select?: boolean;
    readonly cancel_on_tap_outside?: boolean;
    /**
     * **Desligado de propósito.** O FedCM do botão foi tentado para fugir do aviso de COOP e é a única
     * variável que mudou entre os logins que funcionaram e o sintoma "clique e nada acontece". A
     * armadilha documentada: a jornada FedCM termina em redirecionamento/POST para o *login endpoint*,
     * e no modo popup + `callback` o `login_uri` é ignorado — sem callback, o padrão é um POST para a
     * própria página (404 no Vite), sem erro no console. Ver o comentário no `initialize`.
     */
    readonly use_fedcm_for_button?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: GoogleButtonOptions): void;
  disableAutoSelect?(): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

/** Erro de carregamento do botão, com a causa provável em pt-BR. */
export class GoogleIndisponivelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleIndisponivelError';
  }
}

const MENSAGEM_CSP =
  'A biblioteca de login do Google não carregou. Se o app está publicado, a causa mais provável é o ' +
  'Content-Security-Policy não autorizar https://accounts.google.com — o botão some sem nenhuma ' +
  'mensagem no console além do bloqueio de CSP. Verifique a conexão e recarregue a página.';

/** Uma promessa por página: o script é buscado uma vez, não uma por remontagem. */
let carregando: Promise<void> | null = null;

/**
 * Handlers do **callback único** do GSI, e o cliente já inicializado.
 *
 * O GSI só aceita uma chamada de `initialize` por página (a última vence, com aviso no console);
 * então o callback é registrado uma vez e consulta estas variáveis a cada resposta.
 */
let handlersAtuais: {
  readonly onCredential: (credential: string) => void;
  readonly onError: (message: string) => void;
} | null = null;
let clienteInicializado: string | null = null;

/** Só para teste: esquece o cliente inicializado (o GSI não desfaz `initialize` na mesma página). */
export function resetGoogleInitForTests(): void {
  handlersAtuais = null;
  clienteInicializado = null;
  carregando = null;
}

function apiDoGoogle(): GoogleIdApi | null {
  return window.google?.accounts?.id ?? null;
}

/**
 * Garante que a biblioteca do Google está carregada.
 *
 * Devolve a mesma promessa para chamadas concorrentes — o app pode montar a tela de entrada e o
 * rodapé de identidade ao mesmo tempo, e as duas não podem baixar a biblioteca duas vezes.
 */
export function loadGoogleScript(url: string = GOOGLE_SCRIPT_URL): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new GoogleIndisponivelError(MENSAGEM_CSP));
  }
  if (apiDoGoogle() !== null) return Promise.resolve();
  if (carregando !== null) return carregando;

  carregando = new Promise<void>((resolve, reject) => {
    const falhar = (): void => {
      // A promessa é descartada: uma segunda tentativa (usuário clicou em "tentar de novo") deve
      // poder baixar o script de novo em vez de herdar para sempre a falha anterior.
      carregando = null;
      reject(new GoogleIndisponivelError(MENSAGEM_CSP));
    };

    const existente = document.querySelector<HTMLScriptElement>(`script[src="${url}"]`);
    if (existente !== null) {
      existente.addEventListener('load', () => resolve());
      existente.addEventListener('error', falhar);
      // Script já carregado antes desta função existir: sem evento, resolve na hora.
      if (apiDoGoogle() !== null) resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => {
      if (apiDoGoogle() === null) {
        falhar();
        return;
      }
      resolve();
    });
    script.addEventListener('error', falhar);
    document.head.append(script);
  });

  return carregando;
}

/**
 * Renderiza o botão oficial dentro do elemento.
 *
 * `onError` recebe a mensagem pronta para a tela. O `auto_select` fica **desligado**: entrar sozinho
 * ao abrir a página é confortável e é exatamente o comportamento que o dono não pediu — e que, num
 * app que gasta dinheiro, faz uma sessão existir sem ninguém ter clicado.
 *
 * Duas defesas contra remontagem, e as duas vêm de avisos **reais** do console do navegador:
 *
 * 1. **`initialize` uma vez por cliente.** O próprio GSI avisa: *"google.accounts.id.initialize() is
 *    called multiple times. This could cause unexpected behavior and only the last initialized
 *    instance will be used."* O React 19 monta, desmonta e remonta em `StrictMode` (é o padrão do
 *    `main.tsx`), então sem esta guarda a tela de entrada inicializa a biblioteca duas vezes a cada
 *    abertura — e o aviso ainda esconde defeito de verdade no meio do ruído.
 * 2. **O contêiner é esvaziado antes de desenhar.** `renderButton` **acrescenta** um iframe; chamado
 *    duas vezes no mesmo elemento, deixaria dois botões sobrepostos.
 *
 * O callback é registrado uma vez só e lê `handlersAtuais` — sempre o mais recente —, para que a
 * guarda do item 1 não congele uma closure antiga quando a tela remonta com outro estado.
 */
export async function renderGoogleButton(
  parent: HTMLElement,
  clientId: string,
  handlers: { readonly onCredential: (credential: string) => void; readonly onError: (message: string) => void },
  options: GoogleButtonOptions = {},
): Promise<void> {
  try {
    await loadGoogleScript();
  } catch (error) {
    handlers.onError(error instanceof Error ? error.message : MENSAGEM_CSP);
    return;
  }

  const api = apiDoGoogle();
  if (api === null) {
    handlers.onError(MENSAGEM_CSP);
    return;
  }

  handlersAtuais = handlers;

  if (clienteInicializado !== clientId) {
    api.initialize({
      client_id: clientId,
      auto_select: false,
      /*
       * `use_fedcm_for_button` fica **desligado**, e isto é uma decisão com histórico — não omissão.
       *
       * Eu liguei a opção para fugir do aviso de COOP, e ela é a **única variável que mudou** entre os
       * dois logins que funcionaram neste app e o momento em que o dono passou a relatar "clique e nada
       * acontece". A apuração (`docs/pesquisa`/`.rebeca/pesquisa/gsis-diagnostico-2026-10-02.md`) achou
       * a armadilha documentada: a jornada FedCM do botão termina num redirecionamento/POST para o
       * *login endpoint*, enquanto a doc de exibição diz que no modo popup + `callback` o `login_uri` é
       * ignorado — sem callback, o padrão é um POST para a própria página, que devolve 404 no Vite, sem
       * chamar o nosso callback e **sem erro vermelho no console**. Sintoma idêntico ao relatado.
       *
       * O caminho de pop-up + `callback` é o que este app usa, é o que já entregou credencial duas
       * vezes, e é o que o servidor de desenvolvimento agora ajuda a manter saudável (COOP
       * `same-origin-allow-popups` e `Referrer-Policy: no-referrer-when-downgrade` no dev, como a doc
       * de Setup pede para http + localhost).
       */
      callback: (response) => {
        // Lê os handlers **do módulo**, e não de uma closure: a instância inicializada é única e
        // precisa sobreviver às remontagens do React sem congelar um estado antigo.
        const atuais = handlersAtuais;
        if (atuais === null) return;
        const credential = response.credential;
        if (typeof credential !== 'string' || credential.length === 0) {
          atuais.onError('O Google não devolveu uma credencial. Tente entrar de novo.');
          return;
        }
        atuais.onCredential(credential);
      },
    });
    clienteInicializado = clientId;
  }

  // Um botão por contêiner: ver item 2 do cabeçalho.
  parent.replaceChildren();

  // O botão é um iframe do Google; ele não aceita as nossas classes, então o contêiner é que recebe
  // o alinhamento. Largura explícita evita o iframe de 0px quando o pai é flex sem `min-width`.
  api.renderButton(parent, { theme: 'outline', size: 'large', text: 'signin_with', locale: 'pt-BR', ...options });
}

/** Esquece a escolha automática de conta ao sair — senão o próximo `initialize` entra sozinho. */
export function forgetGoogleAccount(): void {
  apiDoGoogle()?.disableAutoSelect?.();
}

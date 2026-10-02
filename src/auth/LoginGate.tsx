/**
 * Portão de entrada — a tela que existe no lugar do app enquanto não há sessão autorizada.
 *
 * **É uma tela, não uma rota.** Não existe `/login`: um endereço de entrada separado é um endereço a
 * mais para alguém contornar, e um lugar a mais para esquecer de proteger. Aqui, o que troca é o que
 * é renderizado dentro do app — a URL que o visitante tentou abrir continua guardada pelo roteador e
 * é para onde ele volta depois de entrar.
 *
 * Os textos dizem o que fazer em cada estado, porque a diferença entre eles é acionável:
 * `sem-configuracao` é uma variável que falta no servidor; `nao-autorizado` é o `sub` que precisa
 * entrar na lista; falha de rede é tentar de novo. Um "acesso negado" genérico não serve para nenhum
 * dos três.
 */

import { useEffect, useRef, useState } from 'react';
import { Card, Button, Pill } from '@/components/ui/primitives';
import { useAuth } from './context';
import { renderGoogleButton } from './google';

/** Onde o Google injeta o iframe do botão. */
function BotaoDoGoogle({ clientId }: { readonly clientId: string }) {
  const alvo = useRef<HTMLDivElement>(null);
  const { signIn, reportarAviso } = useAuth();
  /** `true` quando o usuário clicou e, depois de um tempo, nenhuma credencial chegou. */
  const [semResposta, setSemResposta] = useState(false);

  /**
   * Quantos segundos esperar antes de admitir que o clique não produziu nada.
   *
   * Não é um `timeout` de login: é um aviso de **possível bloqueio**. Escolher conta no diálogo do
   * Google pode levar mais que isso, e a mensagem diz isso — ela orienta sem acusar.
   */
  const SEGUNDOS_SEM_RESPOSTA = 15;

  useEffect(() => {
    const elemento = alvo.current;
    if (elemento === null) return;

    let vivo = true;
    let relogio: ReturnType<typeof setTimeout> | undefined;

    void renderGoogleButton(
      elemento,
      clientId,
      {
        onCredential: (credential) => {
          if (relogio !== undefined) clearTimeout(relogio);
          void signIn(credential);
        },
        onError: (message) => {
          if (vivo) reportarAviso(message);
        },
      },
      {
        // Largura mínima legível no celular; o botão oficial não aceita menos que 200px.
        width: 280,
        click_listener: () => {
          if (!vivo) return;
          setSemResposta(false);
          if (relogio !== undefined) clearTimeout(relogio);
          relogio = setTimeout(() => {
            if (vivo) setSemResposta(true);
          }, SEGUNDOS_SEM_RESPOSTA * 1000);
        },
      },
    );

    return () => {
      vivo = false;
      if (relogio !== undefined) clearTimeout(relogio);
    };
  }, [clientId, signIn, reportarAviso]);

  return (
    <div>
      <div ref={alvo} className="flex justify-center min-h-[44px]" />
      {semResposta && (
        /*
         * O modo de falha que travou o dono, dito em voz alta: o clique acontece e **nada** aparece. A
         * causa usual é bloqueio de pop-up/FedCM para `accounts.google.com` no navegador — e a pessoa
         * não tem como adivinhar isso olhando a tela, porque o aviso do Google só existe no console.
         */
        <p role="alert" className="mt-3 rounded-md border border-line bg-sunken p-3 text-[12px] text-ink-2">
          O Google não devolveu a credencial. Se a janela do Google <strong>não abriu</strong>, o
          navegador está bloqueando pop-up/login para <code>accounts.google.com</code> — libere o
          pop-up para este site (ícone na barra de endereço) e tente de novo. Se você ainda está
          escolhendo a conta, ignore este aviso.
        </p>
      )}
    </div>
  );
}

export function LoginGate() {
  const { status, identity, clientId, allowedIdentities, aviso, signOut, reload } = useAuth();

  return (
    <main className="min-h-dvh grid place-items-center p-4 bg-bg">
      <Card className="w-full max-w-[560px] p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="ams-logo-mark">
            <img src="/icone-96.png" alt="" width={32} height={32} />
          </span>
          <div>
            <p className="ams-font-display text-[18px] font-semibold text-ink">AI Media Studio</p>
            <p className="text-[12px] text-ink-3">Operação de canais · acesso restrito</p>
          </div>
        </div>

        <h1 className="mt-6 text-[20px] font-semibold text-ink">
          {status === 'carregando' ? 'Verificando o acesso…' : 'Entrar para continuar'}
        </h1>

        {/*
          Por que o app deixou de abrir para qualquer visitante: ele fala com provedores de IA pagos.
          O endereço é público, então "ninguém vai descobrir" nunca foi controle de acesso.
        */}
        <p className="mt-2 text-[13px] text-ink-2">
          Este app usa chaves de IA que valem dinheiro. O acesso é restrito às contas autorizadas, e a
          verificação acontece no servidor — o navegador nunca vê chave nenhuma.
        </p>

        {aviso !== null && (
          <p role="alert" className="mt-4 rounded-md border border-line bg-sunken p-3 text-[12px] text-ink-2">
            {aviso}
          </p>
        )}

        <div className="mt-6">
          {status === 'carregando' && <p className="text-[13px] text-ink-3">Aguarde um instante…</p>}

          {status === 'sem-configuracao' && (
            <div className="rounded-md border border-line bg-sunken p-3">
              <p className="text-[13px] font-semibold text-ink">A autenticação não está configurada</p>
              <p className="mt-1 text-[12px] text-ink-2">
                O servidor não tem <code>GOOGLE_CLIENT_ID</code>. Sem essa variável não existe como
                verificar a credencial do Google, e por isso <strong>nenhuma</strong> rota de IA ou de
                mídia responde — a recusa é deliberada, para que um erro de configuração não vire porta
                aberta. Defina a variável no ambiente do servidor (na Vercel: Settings → Environment
                Variables) e recarregue.
              </p>
              <Button className="mt-3" onClick={reload}>
                Já configurei — tentar de novo
              </Button>
            </div>
          )}

          {status === 'anonimo' && clientId !== null && <BotaoDoGoogle clientId={clientId} />}

          {status === 'anonimo' && clientId === null && aviso !== null && (
            <Button className="mt-1" onClick={reload}>
              Tentar de novo
            </Button>
          )}

          {status === 'nao-autorizado' && identity !== null && (
            <div className="rounded-md border border-line bg-sunken p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Pill tone="warn">conta ainda não autorizada</Pill>
                {allowedIdentities === 0 && <Pill tone="info" dot={false}>nenhuma identidade configurada</Pill>}
              </div>

              <p className="mt-2 text-[13px] text-ink-2">
                Você entrou como{' '}
                <strong className="text-ink">{identity.email ?? identity.name ?? 'conta Google'}</strong>, e
                o Google confirmou a identidade. O que falta é autorizar <em>esta</em> conta no servidor.
              </p>

              {/*
                Diagnóstico que separa as duas causas possíveis — e que existe porque as duas já se
                confundiram na prática: "o servidor não tem lista nenhuma" e "o servidor tem lista, mas
                esta conta não está nela" exigem ações opostas. Uma é editar o `.env`; a outra é
                conferir **qual conta** o seletor do Google escolheu (ele troca de conta sozinho entre
                tentativas, e o `sub` de cada conta é diferente).

                Diz a **quantidade**, nunca a lista: quem já se autenticou no Google pode ver o número,
                não quem tem acesso.
              */}
              <p className="mt-2 text-[12px] text-ink-2">
                {allowedIdentities === 0
                  ? 'O servidor está com a lista de acesso vazia: nenhuma conta está autorizada ainda.'
                  : `O servidor tem ${allowedIdentities} conta(s) autorizada(s), e esta não é uma delas.`}
                {identity.email !== undefined && (
                  <> Confira o e-mail acima: se você tem mais de uma conta Google, o seletor pode ter entrado com a errada.</>
                )}
              </p>

              <p className="mt-3 text-[12px] font-semibold text-ink">Copie o identificador abaixo</p>
              {/*
                O `sub` aparece em texto selecionável, e não só num botão de copiar: cópia por botão
                depende de permissão de clipboard do navegador, e o dono pode estar num contexto em
                que ela é negada (aba sem foco, contexto não seguro). Selecionar à mão sempre funciona.
              */}
              <code className="mt-1 block select-all break-all rounded border border-line bg-surface px-2 py-1.5 text-[12px] ams-num text-ink">
                {identity.sub}
              </code>
              <p className="mt-2 text-[12px] text-ink-2">
                Cole esse valor em <code>REBECA_ALLOWED_SUBS</code> (separado por vírgula, se houver mais
                de uma conta) no ambiente do servidor e recarregue a página. O identificador é o{' '}
                <strong>sub</strong>, não o e-mail: uma conta Google pode trocar de e-mail, e o sub não
                muda nunca.
              </p>
            </div>
          )}

        </div>

        {status === 'nao-autorizado' && (
          <div className="mt-5 border-t border-line pt-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[12px] text-ink-3">
              {identity?.email ?? identity?.sub ?? 'Sessão ativa'}
            </p>
            <Button variant="ghost" onClick={signOut}>
              Sair / trocar de conta
            </Button>
          </div>
        )}
      </Card>
    </main>
  );
}

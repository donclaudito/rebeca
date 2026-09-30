import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Plug, RotateCcw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Button,
  Card,
  ErrorState,
  IconTile,
  Pill,
  SectionHead,
  Skeleton,
} from '@/components/ui/primitives';
import { YouTubeGlyph } from '@/components/icons';
import { AiSettingsPanel } from './AiSettingsPanel';
import { useAiStatus } from '@/ai/hooks';
import { useChannelId } from '@/app/useChannel';
import { resetStore } from '@/data/client';
import { useChannel } from '@/data/hooks';
import { formatCompact, formatInt, formatUsd } from '@/lib/format';

/** Configurações — dados do canal, conexão com o YouTube e preferências. */
export function ConfiguracoesPage() {
  const channelId = useChannelId();
  const channel = useChannel(channelId);
  const queryClient = useQueryClient();

  const resetExample = async () => {
    resetStore();
    await queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'channel' });
  };

  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Os dados deste canal e a conexão com o YouTube. Nenhuma credencial aparece nesta tela."
      />

      <div className="ams-split grid lg:grid-cols-12 gap-4" data-split="lg">
        <div className="ams-split__main lg:col-span-7 flex flex-col gap-4">
          <Card className="p-4">
            <SectionHead step={1} title="Canal" hint="identificação usada em toda a interface" />
            {channel.isLoading && <Skeleton className="h-[180px]" />}
            {channel.isError && (
              <ErrorState message="Não conseguimos carregar os dados deste canal." onRetry={channel.refetch} />
            )}
            {channel.data && (
              <dl className="grid sm:grid-cols-2 gap-3">
                <Field label="Nome" value={channel.data.name} />
                <Field label="Tipo" value={channel.data.kind} />
                <Field label="Nicho" value={channel.data.niche} />
                <Field label="Idioma" value={channel.data.language} />
                <Field label="Inscritos" value={`${formatInt(channel.data.subscribers)} (${formatCompact(channel.data.subscribers)})`} />
                <Field label="Views acumuladas" value={formatCompact(channel.data.totalViews)} />
              </dl>
            )}
          </Card>

          <Card className="p-4">
            <SectionHead step={2} title="Conexão com o YouTube" hint="a única porta de publicação" />
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="flex items-center gap-3">
                <IconTile tone="rose">
                  <YouTubeGlyph size={20} />
                </IconTile>
                <span>
                  <span className="block text-[13px] font-semibold text-ink">
                    {channel.data?.name ?? 'Canal'}
                  </span>
                  <span className="block text-[11px] text-ink-3">
                    {channel.data?.connected
                      ? 'Conectado — publicação automática liberada após a sua aprovação'
                      : 'Não conectado'}
                  </span>
                </span>
              </span>
              <Pill tone={channel.data?.connected ? 'ok' : 'warn'}>
                {channel.data?.connected ? 'Conectado' : 'Pendente'}
              </Pill>
            </div>

            <ul className="flex flex-col gap-2 mt-4 text-[12px] text-ink-2">
              <li className="flex items-center gap-2">
                <BadgeCheck size={14} className="text-ok shrink-0" aria-hidden="true" />
                Envio de vídeo e thumbnail
              </li>
              <li className="flex items-center gap-2">
                <BadgeCheck size={14} className="text-ok shrink-0" aria-hidden="true" />
                Agendamento e publicação
              </li>
              <li className="flex items-center gap-2">
                <BadgeCheck size={14} className="text-ok shrink-0" aria-hidden="true" />
                Leitura de métricas do canal
              </li>
            </ul>

            <p className="text-[11px] text-ink-3 mt-3 flex items-start gap-1.5 border-t border-line pt-3">
              <ShieldCheck size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              A credencial de acesso fica no servidor, cifrada. Ela nunca é exibida, registrada em log nem
              enviada ao navegador.
            </p>
          </Card>

          <Card className="p-4">
            <SectionHead step={3} title="Preferências" hint="ainda não editáveis no protótipo" />
            <ul className="flex flex-col gap-3">
              <Preference
                title="Pedir aprovação antes de publicar"
                description="Desligar esta opção publicaria sem revisão humana — não é permitido nesta fase do produto."
                locked
              />
              <Preference
                title="Sugerir o melhor horário automaticamente"
                description="A IA sugere, mas você confirma no calendário."
                locked
              />
              <Preference
                title="Reaproveitar cenário entre episódios do mesmo tema"
                description="Reduz custo por vídeo; sujeito a validação de consistência de personagem."
                locked
              />
            </ul>
          </Card>

          <AiEngineCard childDirected={channel.data?.childDirected ?? false} />
          <AiSettingsPanel />
        </div>

        <div id="barra-lateral-direita" className="ams-split__aside lg:col-span-5 flex flex-col gap-4">
          <Card className="p-4">
            <SectionHead title="Protótipo" hint="dados de exemplo" />
            <p className="text-[12px] text-ink-2">
              Este app roda com dados de exemplo. Aprovar, reagendar ou rejeitar muda apenas a memória da
              sessão — nada é enviado a lugar nenhum.
            </p>
            <Button className="w-full mt-3" onClick={() => void resetExample()}>
              <RotateCcw size={15} aria-hidden="true" />
              Reiniciar os dados de exemplo
            </Button>
          </Card>

          <Card className="p-4">
            <SectionHead title="O que ainda não existe" hint="seja honesto com o usuário" />
            <ul className="flex flex-col gap-2 text-[12px] text-ink-3">
              <li>Conectar um canal novo pelo Google</li>
              <li>Papéis de acesso (dono, editor, revisor)</li>
              <li>Notificações por push no celular</li>
              <li>Limite de gasto mensal por canal</li>
            </ul>
            <p className="text-[11px] text-ink-3 mt-3 border-t border-line pt-3">
              Cada um destes depende de uma decisão de produto ainda aberta (D2 a D6 no estado do
              projeto).
            </p>
          </Card>

          <Card className="p-4">
            <SectionHead title="Zona de risco" hint="ações que interrompem o canal" />
            <div className="flex items-start gap-2.5 text-[12px] text-ink-2">
              <IconTile tone="rose" size="sm">
                <TriangleAlert size={14} />
              </IconTile>
              <p>
                Desconectar o YouTube impede a publicação automática. A ação está desabilitada neste
                protótipo porque não há conexão real para desfazer.
              </p>
            </div>
            <Button variant="danger" className="w-full mt-3" disabled>
              <Plug size={15} aria-hidden="true" />
              Desconectar canal
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="ams-stat__label">{label}</dt>
      <dd className="text-[13px] text-ink">{value}</dd>
    </div>
  );
}

/**
 * Painel do motor de IA.
 *
 * Existe porque, até aqui, o app dizia "a IA fez isso" sem dizer **qual** IA, se ela estava de fato
 * ligada, quanto custou e qual é o teto. Três informações que o operador precisa e não encontrava:
 *
 * 1. **Está ligada ou é simulação?** Sem chave, o app responde por simulação — e a tela diz isso.
 * 2. **Onde se configura?** O nome da variável de ambiente aparece: é o dado acionável.
 * 3. **Qual o teto?** Por chamada e por dia, com o que já foi gasto hoje.
 *
 * Sobre a regra "interface sem termo interno" (`docs/04` §5.5): nome de fornecedor **não** aparece na
 * navegação normal do produto. Nesta tela, que é a do operador, ele fica dentro de um bloco
 * recolhido, marcado como detalhe técnico — esconder qual fornecedor atende o canal infantil tornaria
 * invisível uma restrição contratual que o produto tem obrigação de mostrar.
 */
function AiEngineCard({ childDirected }: { childDirected: boolean }) {
  const status = useAiStatus();

  return (
    <Card className="p-4">
      <SectionHead
        step={4}
        title="Inteligência artificial"
        hint="cada função tem o modelo que faz sentido para ela"
      />

      {status.isLoading && <Skeleton className="h-[160px]" />}

      {status.isError && (
        <ErrorState
          message="Não conseguimos falar com a camada de IA do servidor. Nenhuma função de IA está disponível agora."
          onRetry={status.refetch}
        />
      )}

      {status.data && (
        <>
          <p className="text-[12px] text-ink-2">
            {status.data.hasAnyKey
              ? 'Provedor configurado no servidor. Cada função do app usa o modelo mais adequado ao trabalho dela — você não precisa escolher.'
              : 'Nenhum provedor configurado ainda. O app responde com conteúdo simulado, com a mesma forma do real, para você validar a experiência. Configure uma chave no servidor para gerar conteúdo de verdade.'}
          </p>

          {childDirected && (
            <p className="text-[11px] mt-2.5 flex items-start gap-1.5" role="status">
              <ShieldCheck size={13} className="mt-0.5 shrink-0 text-ok" aria-hidden="true" />
              <span>
                Este canal é dirigido a crianças, então vale uma lista restrita de fornecedores: só
                entram os que permitem, no contrato, serviço voltado a menores.
                {status.data.childDirectedFallsBackToSimulation && status.data.hasAnyKey && (
                  <>
                    {' '}
                    <strong>
                      Nenhum fornecedor permitido está configurado, então este canal está em
                      simulação
                    </strong>{' '}
                    — os provedores que você tem não podem atender canal infantil.
                  </>
                )}
                {status.data.policyOverride && (
                  <>
                    {' '}
                    <strong>
                      A liberação de fornecedor não verificado está ligada por decisão explícita
                    </strong>
                    . Isso é uma escolha registrada, não um padrão do produto.
                  </>
                )}
              </span>
            </p>
          )}

          <dl className="grid grid-cols-2 gap-3 mt-3.5">
            <Field label="Teto por chamada" value={formatUsd(status.data.budget.perCallUsd)} />
            <Field label="Teto por dia" value={formatUsd(status.data.budget.dailyUsd)} />
            <Field label="Gasto hoje" value={formatUsd(status.data.budget.spentTodayUsd)} />
            <Field
              label="Registro de custo"
              value={status.data.budget.ledger === 'csv' ? 'Em arquivo, durável' : 'Só em memória'}
            />
          </dl>

          {status.data.budget.ledger === 'memoria' && (
            <p className="text-[11px] text-warn mt-2.5 flex items-start gap-1.5">
              <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              Este ambiente não tem onde gravar o livro de custos: o gasto aparece na tela, mas não
              fica registrado de forma durável. Registrar custo é requisito do produto, então isto
              está declarado aqui em vez de escondido.
            </p>
          )}

          <details className="mt-3.5 border-t border-line pt-3">
            <summary className="text-[11px] font-semibold text-ink-3 cursor-pointer">
              Detalhes técnicos (para quem configura o servidor)
            </summary>

            <ul className="flex flex-col gap-2 mt-2.5">
              {status.data.providers.map((provider) => (
                <li key={provider.provider} className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] ams-num text-ink-2">{provider.envVar}</span>
                  <span className="flex items-center gap-1.5">
                    <Pill tone={provider.configured ? 'ok' : 'neutral'} dot={false}>
                      {provider.configured ? 'configurado' : 'ausente'}
                    </Pill>
                    <Pill
                      tone={provider.allowedForChildDirected ? 'ok' : 'warn'}
                      dot={false}
                    >
                      {provider.allowedForChildDirected ? 'serve canal infantil' : 'não serve canal infantil'}
                    </Pill>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">
                Modelo por função — canal comum
              </p>
              <ul className="text-[11px] ams-num text-ink-2 mt-1">
                {Object.entries(status.data.models).map(([tier, model]) => (
                  <li key={tier}>
                    {tier}: {model}
                  </li>
                ))}
              </ul>
            </div>

            {childDirected && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">
                  Modelo por função — canal infantil
                </p>
                <ul className="text-[11px] ams-num text-ink-2 mt-1">
                  {Object.entries(status.data.childDirectedModels).map(([tier, model]) => (
                    <li key={tier}>
                      {tier}: {model}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {status.data.budget.ledgerPath && (
              <p className="text-[10px] text-ink-3 mt-3 break-all">
                Livro de custos: {status.data.budget.ledgerPath}
              </p>
            )}
          </details>
        </>
      )}
    </Card>
  );
}

function Preference({
  title,
  description,
  locked,
}: {
  title: string;
  description: string;
  locked: boolean;
}) {
  return (
    <li className="flex items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold text-ink">{title}</span>
        <span className="block text-[11px] text-ink-3">{description}</span>
      </span>
      <Pill tone={locked ? 'ok' : 'neutral'}>{locked ? 'Ativo' : 'Inativo'}</Pill>
    </li>
  );
}

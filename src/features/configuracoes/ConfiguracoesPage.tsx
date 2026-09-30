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
import { useChannelId } from '@/app/useChannel';
import { resetStore } from '@/data/client';
import { useChannel } from '@/data/hooks';
import { formatCompact, formatInt } from '@/lib/format';

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

      <div className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 flex flex-col gap-4">
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
        </div>

        <div className="lg:col-span-5 flex flex-col gap-4">
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

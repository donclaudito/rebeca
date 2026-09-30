import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Library, Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ContentCard } from '@/components/content/ContentCard';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  SectionHead,
  Skeleton,
  cn,
} from '@/components/ui/primitives';
import { useChannelId } from '@/app/useChannel';
import { useContents } from '@/data/hooks';
import { STATUS_META } from '@/components/status';
import type { ContentStatus } from '@/data/types';

type Filtro = 'todos' | ContentStatus;

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'revisao', label: STATUS_META.revisao.label },
  { id: 'agendado', label: STATUS_META.agendado.label },
  { id: 'aprovado', label: STATUS_META.aprovado.label },
  { id: 'gerando', label: STATUS_META.gerando.label },
  { id: 'publicado', label: STATUS_META.publicado.label },
  { id: 'falhou', label: STATUS_META.falhou.label },
];

function isFiltro(value: string | null): value is Filtro {
  return value !== null && FILTROS.some((filtro) => filtro.id === value);
}

/** Conteúdo — a biblioteca do canal, filtrada por estado do ciclo. */
export function ConteudoPage() {
  const channelId = useChannelId();
  const [params, setParams] = useSearchParams();
  const contents = useContents(channelId);

  const raw = params.get('filtro');
  const filtro: Filtro = isFiltro(raw) ? raw : 'todos';

  const items = useMemo(
    () => (contents.data ?? []).filter((item) => (filtro === 'todos' ? true : item.status === filtro)),
    [contents.data, filtro],
  );

  const counts = useMemo(() => {
    const map = new Map<Filtro, number>();
    map.set('todos', contents.data?.length ?? 0);
    for (const item of contents.data ?? []) {
      map.set(item.status, (map.get(item.status) ?? 0) + 1);
    }
    return map;
  }, [contents.data]);

  return (
    <>
      <PageHeader
        title="Conteúdo"
        subtitle="Tudo que a IA produziu para este canal, com o estado real de cada conteúdo no ciclo."
        actions={
          <Link to={`/c/${channelId}/calendario`} className="ams-btn">
            <Plus size={15} aria-hidden="true" />
            Planejar a semana
          </Link>
        }
      />

      <div className="flex items-center gap-2 flex-wrap mb-4" role="tablist" aria-label="Filtrar por estado">
        {FILTROS.map((entry) => {
          const active = entry.id === filtro;
          const count = counts.get(entry.id) ?? 0;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                const next = new URLSearchParams(params);
                if (entry.id === 'todos') next.delete('filtro');
                else next.set('filtro', entry.id);
                setParams(next, { replace: true });
              }}
              className={cn(
                'ams-btn !min-h-[34px] !px-3 !text-[12px]',
                active && 'ams-card--strong !border-[color:var(--ams-border-strong)]',
              )}
            >
              {entry.label}
              <span className="ams-num text-ink-3">{count}</span>
            </button>
          );
        })}
      </div>

      {contents.isLoading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-[280px]" />
          ))}
        </div>
      )}

      {contents.isError && (
        <Card className="p-4">
          <ErrorState message="Não conseguimos carregar os conteúdos deste canal." onRetry={contents.refetch} />
        </Card>
      )}

      {contents.data && items.length === 0 && (
        <Card className="p-4">
          <EmptyState
            icon={<Library size={22} />}
            title={filtro === 'todos' ? 'Este canal ainda não tem conteúdo' : 'Nada neste estado'}
            description={
              filtro === 'todos'
                ? 'Quando a IA produzir o primeiro conteúdo, ele aparece aqui com thumbnail, SEO e custo.'
                : 'Nenhum conteúdo deste canal está nesse estado agora. Troque o filtro para ver os outros.'
            }
            action={
              <Button onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                Ver todos os conteúdos
              </Button>
            }
          />
        </Card>
      )}

      {contents.data && items.length > 0 && (
        <section aria-label="Conteúdos do canal">
          <SectionHead title={`${items.length} ${items.length === 1 ? 'conteúdo' : 'conteúdos'}`} hint="dados de exemplo" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
            {items.map((item) => (
              <ContentCard key={item.id} item={item} channelId={channelId} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Library, Plus, SearchX } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ContentCard } from '@/components/content/ContentCard';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  SectionHead,
  Skeleton,
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

/** Busca sem acento e sem caixa: "luna" acha "Luna", "borboletas" acha "Borboletas". */
function normalizar(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Conteúdo — a biblioteca do canal, filtrada por estado do ciclo e pela busca. */
export function ConteudoPage() {
  const channelId = useChannelId();
  const [params, setParams] = useSearchParams();
  const contents = useContents(channelId);

  const raw = params.get('filtro');
  const filtro: Filtro = isFiltro(raw) ? raw : 'todos';
  const busca = params.get('busca') ?? '';

  const items = useMemo(() => {
    const termo = normalizar(busca.trim());
    return (contents.data ?? []).filter((item) => {
      if (filtro !== 'todos' && item.status !== filtro) return false;
      if (!termo) return true;
      const alvo = normalizar(
        [item.title, item.hook, item.theme, item.seo.description, ...item.seo.tags].join(' '),
      );
      return alvo.includes(termo);
    });
  }, [contents.data, filtro, busca]);

  const counts = useMemo(() => {
    const map = new Map<Filtro, number>();
    map.set('todos', contents.data?.length ?? 0);
    for (const item of contents.data ?? []) {
      map.set(item.status, (map.get(item.status) ?? 0) + 1);
    }
    return map;
  }, [contents.data]);

  /** Escreve um parâmetro preservando o outro (filtro e busca convivem na URL). */
  function setParam(key: 'filtro' | 'busca', value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  }

  return (
    <>
      <PageHeader
        title="Conteúdo"
        subtitle="Tudo que a IA produziu para este canal, com o estado real de cada conteúdo no ciclo."
        actions={
          <Link to={`/c/${channelId}/calendario`} className="ams-btn">
            <Plus size={16} aria-hidden="true" />
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
              onClick={() => setParam('filtro', entry.id === 'todos' ? null : entry.id)}
              className="ams-chip"
            >
              {entry.label}
              <span className="ams-chip__count">{count}</span>
            </button>
          );
        })}
      </div>

      {busca && (
        <p className="text-[14px] text-ink-3 mb-3" role="status">
          Buscando por “{busca}”.{' '}
          <button
            type="button"
            className="text-accent underline bg-transparent border-0 cursor-pointer p-0 text-[14px]"
            onClick={() => setParam('busca', null)}
          >
            Limpar busca
          </button>
        </p>
      )}

      {contents.isLoading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-[300px]" />
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
          {busca ? (
            <EmptyState
              icon={<SearchX size={22} />}
              title="Nada encontrado nesta busca"
              description={`Nenhum conteúdo deste canal casa com “${busca}”. A busca olha título, gancho, tema, descrição e tags.`}
              action={<Button onClick={() => setParam('busca', null)}>Limpar busca</Button>}
            />
          ) : (
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
          )}
        </Card>
      )}

      {contents.data && items.length > 0 && (
        <section aria-label="Conteúdos do canal">
          <SectionHead
            title={`${items.length} ${items.length === 1 ? 'conteúdo' : 'conteúdos'}`}
            hint="dados de exemplo"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
            {items.map((item) => (
              <ContentCard key={item.id} item={item} channelId={channelId} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

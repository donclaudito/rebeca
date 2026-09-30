import { Lock, Palette as PaletteIcon, Sparkles, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  ArtSlot,
  Card,
  ErrorState,
  IconTile,
  Pill,
  SectionHead,
  Skeleton,
} from '@/components/ui/primitives';
import { useChannelId } from '@/app/useChannel';
import { useBrandKit, useChannel, useCharacters } from '@/data/hooks';
import { formatDayMonth } from '@/lib/date';
import type { Character } from '@/data/types';

const STATUS_LABEL: Record<Character['status'], { label: string; tone: 'ok' | 'warn' | 'neutral' }> = {
  oficial: { label: 'Oficial', tone: 'ok' },
  em_aprovacao: { label: 'Em aprovação', tone: 'warn' },
  rascunho: { label: 'Rascunho', tone: 'neutral' },
};

/** Identidade — Brand Kit e Character Sheet do canal (docs/00-visao-produto.md §5). */
export function IdentidadePage() {
  const channelId = useChannelId();
  const channel = useChannel(channelId);
  const brand = useBrandKit(channelId);
  const characters = useCharacters(channelId);

  return (
    <>
      <PageHeader
        title="Identidade"
        subtitle="A marca e os personagens deste canal. É daqui que sai a consistência entre episódios."
      />

      <div className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 flex flex-col gap-4">
          <Card className="p-4">
            <SectionHead step={1} title="Brand Kit" hint="cores, tipografia, voz e tom" />

            {brand.isLoading && <Skeleton className="h-[220px]" />}
            {brand.isError && (
              <ErrorState message="Este canal ainda não tem Brand Kit." onRetry={brand.refetch} />
            )}
            {brand.data && (
              <>
                <p className="ams-stat__label mb-2">Paleta</p>
                <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {brand.data.palette.map((color) => (
                    <li key={color.hex}>
                      <span
                        className="block h-[54px] rounded-[12px] border border-line"
                        style={{ background: color.hex }}
                        aria-hidden="true"
                      />
                      <span className="block text-[11px] font-semibold text-ink mt-1.5">{color.name}</span>
                      <span className="block text-[10px] text-ink-3 ams-num">{color.hex}</span>
                    </li>
                  ))}
                </ul>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="ams-stat__label mb-2">Tipografia</p>
                    <ul className="flex flex-col gap-1.5">
                      {brand.data.fonts.map((font) => (
                        <li key={font.role} className="text-[12px] text-ink-2">
                          <span className="text-ink-3">{font.role}: </span>
                          {font.family}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="ams-stat__label mb-2">Voz e tom</p>
                    <p className="text-[12px] text-ink-2">{brand.data.voice}</p>
                    <p className="text-[12px] text-ink-3 mt-1">{brand.data.tone}</p>
                  </div>
                </div>

                <p className="text-[10px] text-ink-3 mt-4 border-t border-line pt-2">
                  Atualizado em {formatDayMonth(new Date(brand.data.updatedAt))}
                </p>
              </>
            )}
          </Card>

          <Card className="p-4">
            <SectionHead step={2} title="Personagens" hint="cada um com seu Character Sheet canônico" />

            {characters.isLoading && <Skeleton className="h-[200px]" />}
            {characters.isError && (
              <ErrorState message="Não conseguimos carregar os personagens deste canal." onRetry={characters.refetch} />
            )}
            {characters.data && (
              <ul className="grid sm:grid-cols-2 gap-3">
                {characters.data.map((character) => {
                  const meta = STATUS_LABEL[character.status];
                  return (
                    <li key={character.id}>
                      <Card className="p-3 flex gap-3">
                        <span className="w-[64px] shrink-0">
                          <ArtSlot
                            label={character.name}
                            alt={`Referência visual do personagem ${character.name}`}
                            ratio="1x1"
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold text-ink">{character.name}</span>
                          <span className="block text-[11px] text-ink-3">{character.role}</span>
                          <span className="flex items-center gap-1.5 flex-wrap mt-2">
                            <Pill tone={meta.tone}>{meta.label}</Pill>
                            <Pill tone="neutral" dot={false}>
                              sheet {character.sheetVersion}
                            </Pill>
                          </span>
                        </span>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="text-[11px] text-ink-3 mt-3 flex items-start gap-1.5 border-t border-line pt-3">
              <Lock size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              Um personagem só entra em produção depois de virar oficial. Enquanto está em aprovação ou
              rascunho, ele não é usado em episódio nenhum.
            </p>
          </Card>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-4">
          <Card variant="strong" className="p-4">
            <SectionHead title="Consistência de personagem" hint="requisito, não estética" />
            <p className="text-[12px] text-ink-2">
              &ldquo;{channel.data?.name ?? 'O canal'}&rdquo; precisa parecer o mesmo em todos os episódios. O
              Character Sheet é a fonte disso: toda geração de imagem parte dele, e qualquer desvio é
              tratado como defeito.
            </p>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <ArtSlot label="Referência" alt="Prancha de referência do personagem principal" ratio="1x1" />
              <ArtSlot label="Expressões" alt="Prancha de expressões do personagem principal" ratio="1x1" />
              <ArtSlot label="Ângulos" alt="Prancha de ângulos do personagem principal" ratio="1x1" />
            </div>
            <p className="text-[10px] text-ink-3 mt-2">
              As pranchas de arte ainda não existem: elas vêm do Brand Kit, não do protótipo.
            </p>
          </Card>

          <Card className="p-4">
            <SectionHead title="Materiais de divulgação" hint="saem do mesmo Brand Kit" />
            <ul className="flex flex-col gap-2 text-[12px] text-ink-2">
              {['Thumbnail do vídeo', 'Short derivado', 'Post de Instagram', 'Story', 'Capa de Reel', 'Post na comunidade'].map(
                (material) => (
                  <li key={material} className="flex items-center gap-2">
                    <IconTile tone="violet" size="sm">
                      <Sparkles size={13} />
                    </IconTile>
                    {material}
                  </li>
                ),
              )}
            </ul>
          </Card>

          <Card className="p-4">
            <SectionHead title="Ferramentas de identidade" hint="o que existe hoje" />
            <ul className="flex flex-col gap-2.5">
              <li className="flex items-center gap-2.5 text-[12px] text-ink-2">
                <IconTile tone="pink" size="sm">
                  <PaletteIcon size={14} />
                </IconTile>
                Paleta, tipografia e tom por canal
              </li>
              <li className="flex items-center gap-2.5 text-[12px] text-ink-2">
                <IconTile tone="amber" size="sm">
                  <Users size={14} />
                </IconTile>
                Personagens com versão de Character Sheet
              </li>
            </ul>
            <p className="text-[11px] text-ink-3 mt-3 border-t border-line pt-3">
              A edição de personagem por conversa (&ldquo;quero as orelhas maiores&rdquo;) ainda não está
              neste protótipo.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}

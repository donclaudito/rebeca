/**
 * Ícones do app.
 *
 * O YouTube saiu da biblioteca de ícones na v1 (marcas foram removidas), então o glifo da marca é
 * um SVG próprio — e ele é o único lugar do app que desenha uma marca de terceiro.
 *
 * Uso **nominativo**: o glifo identifica a plataforma YouTube (na tela de Configurações, junto da
 * conexão da conta). Ele **não** é a marca deste produto — usar o play-button vermelho como logo do
 * AI Media Studio seria se passar por outro produto. As cores vêm de classe CSS, nunca de `fill`
 * literal: apresentação em SVG não aceita `var()` (docs/03 §10).
 */

import type { ReactNode } from 'react';
import {
  BadgeCheck,
  Brain,
  CalendarClock,
  ChartColumn,
  Clapperboard,
  CloudUpload,
  Compass,
  FileText,
  Image as ImageIcon,
  Search,
  Users,
} from 'lucide-react';

/** Mapa módulo do ciclo → ícone. Ver docs/03 §7. */
export const MODULE_ICONS: Record<string, ReactNode> = {
  estrategia: <Compass size={20} />,
  personagens: <Users size={20} />,
  roteiro: <FileText size={20} />,
  geracao: <Clapperboard size={20} />,
  thumbnail: <ImageIcon size={20} />,
  seo: <Search size={20} />,
  aprovacao: <BadgeCheck size={20} />,
  agendamento: <CalendarClock size={20} />,
  upload: <CloudUpload size={20} />,
  analytics: <ChartColumn size={20} />,
  aprendizado: <Brain size={20} />,
};

interface GlyphProps {
  size?: number;
  className?: string;
}

export function YouTubeGlyph({ size = 16, className }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label="YouTube"
      focusable="false"
    >
      <path
        className="ams-yt-glyph__body"
        d="M23.5 6.9a3 3 0 0 0-2.1-2.1C19.5 4.3 12 4.3 12 4.3s-7.5 0-9.4.5A3 3 0 0 0 .5 6.9C0 8.8 0 12 0 12s0 3.2.5 5.1a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.1.5-5.1s0-3.2-.5-5.1Z"
      />
      <path className="ams-yt-glyph__play" d="M9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />
    </svg>
  );
}


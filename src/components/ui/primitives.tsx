/**
 * Primitivos visuais do AI Media Studio.
 * Cada um corresponde a uma linha de docs/03-design-system.md §6.
 */

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import type { TileTone } from '@/data/types';

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/* --- Card ---------------------------------------------------------------- */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'glass' | 'strong' | 'sunken' | 'flush';
}

export function Card({ variant = 'glass', className, children, ...rest }: CardProps) {
  const variantClass =
    variant === 'glass'
      ? ''
      : variant === 'strong'
        ? 'ams-card--strong'
        : variant === 'sunken'
          ? 'ams-card--sunken'
          : 'ams-card--flush';
  return (
    <div className={cn('ams-card', variantClass, className)} {...rest}>
      {children}
    </div>
  );
}

/* --- Section head -------------------------------------------------------- */

interface SectionHeadProps {
  /** Número de leitura (os modelos usam 1, 2, 3, 4). Opcional. */
  step?: number;
  title: string;
  hint?: string;
  rule?: boolean;
  action?: ReactNode;
}

export function SectionHead({ step, title, hint, rule = true, action }: SectionHeadProps) {
  return (
    <div className="ams-section-head">
      {step !== undefined && (
        <span className="ams-section-num" aria-hidden="true">
          {step}
        </span>
      )}
      <h2 className="ams-section-title">{title}</h2>
      {hint && <span className="ams-section-hint">{hint}</span>}
      {rule && <span className="ams-section-rule" aria-hidden="true" />}
      {action}
    </div>
  );
}

/* --- Icon tile ----------------------------------------------------------- */

interface IconTileProps {
  tone?: TileTone;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  className?: string;
}

export function IconTile({ tone = 'blue', size = 'md', children, className }: IconTileProps) {
  return (
    <span
      className={cn('ams-tile', `ams-tile--${tone}`, size === 'sm' && 'ams-tile--sm', size === 'lg' && 'ams-tile--lg', className)}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

/* --- Pill ---------------------------------------------------------------- */

export type PillToneName = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

interface PillProps {
  tone?: PillToneName;
  children: ReactNode;
  dot?: boolean;
}

export function Pill({ tone = 'neutral', children, dot = true }: PillProps) {
  return (
    <span className={cn('ams-pill', tone !== 'neutral' && `ams-pill--${tone}`)}>
      {dot && <span className="ams-pill__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

/* --- Progress ------------------------------------------------------------ */

interface ProgressBarProps {
  /** 0 a 100. */
  value: number;
  label: string;
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] font-semibold text-ink-2">{label}</span>
        <span className="text-[11px] text-ink-3 ams-num">{Math.round(clamped)}%</span>
      </div>
      <div
        className="ams-progress"
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="ams-progress__fill" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

/* --- Avatar -------------------------------------------------------------- */

interface ChannelAvatarProps {
  initials: string;
  tone?: TileTone;
  size?: number;
  /** Texto alternativo obrigatório: descreve o canal, não o arquivo. */
  label: string;
}

export function ChannelAvatar({ initials, size = 40, label }: ChannelAvatarProps) {
  return (
    <span
      className="ams-avatar"
      role="img"
      aria-label={label}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials}
    </span>
  );
}

/* --- Slot de arte -------------------------------------------------------- */

interface ArtSlotProps {
  /** Rótulo do espaço reservado (ex. "Thumbnail", "Brand Kit"). */
  label: string;
  /** O que a arte mostra — vira `aria-label`. */
  alt: string;
  ratio?: '16x9' | '9x16' | '1x1';
  className?: string;
}

/**
 * Placeholder honesto: a arte 3D e a personagem são do `rebeca-branding` (docs/03 §8).
 * O slot reserva a proporção correta para a arte entrar sem mexer no layout.
 */
export function ArtSlot({ label, alt, ratio = '16x9', className }: ArtSlotProps) {
  return (
    <div className={cn('ams-art', `ams-art--${ratio}`, className)} role="img" aria-label={alt}>
      <span>
        {label}
        <br />
        <span className="normal-case font-normal tracking-normal">arte pendente</span>
      </span>
    </div>
  );
}

/* --- Botão --------------------------------------------------------------- */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'primary' | 'danger';
  size?: 'md' | 'lg';
}

export function Button({ variant = 'ghost', size = 'md', className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'ams-btn',
        variant === 'primary' && 'ams-btn--primary',
        variant === 'danger' && 'ams-btn--danger',
        size === 'lg' && 'ams-btn--lg',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* --- Estados: carregando, vazio, erro ------------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('ams-skel', className)} aria-hidden="true" />;
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  /** A ação que resolve o vazio. Sem ação, o vazio é um beco sem saída. */
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-10 px-6">
      <IconTile tone="violet" size="lg">
        {icon}
      </IconTile>
      <h3 className="text-[15px]">{title}</h3>
      <p className="text-[13px] text-ink-3 max-w-[420px]">{description}</p>
      {action}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Não deu para carregar', message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-10 px-6" role="alert">
      <IconTile tone="rose" size="lg">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </IconTile>
      <h3 className="text-[15px]">{title}</h3>
      <p className="text-[13px] text-ink-3 max-w-[420px]">{message}</p>
      {onRetry && <Button onClick={onRetry}>Tentar de novo</Button>}
    </div>
  );
}

/* --- Faixa de dados de exemplo ------------------------------------------- */

export function SampleDataRibbon() {
  return (
    <span className="ams-ribbon">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
      Dados de exemplo
    </span>
  );
}

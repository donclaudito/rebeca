import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card, cn } from './primitives';
import { formatSignedPct } from '@/lib/format';

interface StatCardProps {
  label: string;
  value: string;
  /** Variação em % contra o período anterior. `null` = não há base de comparação. */
  deltaPct?: number | null;
  /** Período do dado. Obrigatório: número sem período é número inventado. */
  period: string;
  /** Contexto do dado (canal, tema). */
  scope: string;
  icon?: ReactNode;
  /** Números menores (cards secundários). */
  compact?: boolean;
}

/**
 * Cartão de indicador. Exige `period` e `scope` de propósito: a skill `rebeca-react` proíbe número
 * sem período, sem canal e sem data de atualização.
 */
export function StatCard({ label, value, deltaPct, period, scope, icon, compact }: StatCardProps) {
  const delta = deltaPct ?? null;
  const tone = delta === null || delta === 0 ? 'neutral' : delta > 0 ? 'up' : 'down';
  const DeltaIcon = tone === 'up' ? ArrowUpRight : tone === 'down' ? ArrowDownRight : Minus;

  return (
    <Card className="p-4 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className="ams-stat__label">{label}</span>
        {icon}
      </div>

      <div className={cn('ams-stat__value', compact && 'ams-stat__value--sm')}>{value}</div>

      <div className="flex items-center gap-2 flex-wrap">
        {delta !== null && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[11px] font-semibold',
              tone === 'up' && 'text-ok',
              tone === 'down' && 'text-danger',
              tone === 'neutral' && 'text-ink-3',
            )}
          >
            <DeltaIcon size={12} aria-hidden="true" />
            {formatSignedPct(delta)}
          </span>
        )}
        <span className="text-[11px] text-ink-3">{period}</span>
      </div>

      <div className="text-[11px] text-ink-3 border-t border-line pt-2 mt-auto">{scope}</div>
    </Card>
  );
}

import type { ReactNode } from 'react';
import { SampleDataRibbon } from '@/components/ui/primitives';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  /** Marca a tela como alimentada por dados de exemplo. */
  sample?: boolean;
}

export function PageHeader({ title, subtitle, actions, sample = true }: PageHeaderProps) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[30px] sm:text-[34px] leading-tight">{title}</h1>
        <p className="text-[13px] text-ink-3 mt-1 max-w-[720px]">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {sample && <SampleDataRibbon />}
        {actions}
      </div>
    </header>
  );
}

import { Link } from 'react-router-dom';
import { MODULE_ICONS } from '@/components/icons';
import { IconTile, Pill, cn } from './primitives';
import type { ChannelId, ModuleState } from '@/data/types';

interface ModuleCardProps {
  module: ModuleState;
  channelId: ChannelId;
}

/**
 * Um módulo do ciclo (docs/03 §7). Mostra o estado **real** do canal naquele módulo e leva à tela
 * onde ele acontece. O módulo de Aprovação é o único que ganha destaque de pendência — é onde o
 * humano é necessário.
 */
export function ModuleCard({ module, channelId }: ModuleCardProps) {
  return (
    <Link
      to={module.href(channelId)}
      className={cn('ams-module', module.pending && 'ams-module--pending')}
      aria-label={`${module.name} — ${module.status}`}
    >
      <IconTile tone={module.tone}>{MODULE_ICONS[module.id] ?? null}</IconTile>
      <span className="min-w-0 flex-1">
        <span className="ams-module__title">
          {module.name}
          {module.pending && (
            <Pill tone="warn" dot={false}>
              pendente
            </Pill>
          )}
        </span>
        <span className="ams-module__desc block">{module.description}</span>
        <span className="ams-module__desc block text-ink-2 font-semibold mt-1">{module.status}</span>
      </span>
    </Link>
  );
}

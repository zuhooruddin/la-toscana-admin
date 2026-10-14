'use client';
import { Stat } from '@/components/ui/kit';
import { useT } from '@/lib/i18n';

export function MenuSummary({ total, secondary, visible, groups = false }: { total?: number; secondary?: number; visible?: number; groups?: boolean }) {
  const t = useT();
  return (
    <div className="grid-4 menu-summary">
      <Stat
        icon={groups ? 'plus' : 'layers'}
        tone="red"
        label={groups ? t('Total de grupos', 'Total groups') : t('Total de categorías', 'Total categories')}
        value={total ?? '—'}
      />
      <Stat
        icon="menu"
        tone="blue"
        label={groups ? t('Total de opciones', 'Total options') : t('Total de productos', 'Total products')}
        value={secondary ?? '—'}
        hint={groups ? t('En todos los grupos', 'Across all groups') : t('En todas las categorías', 'Across all categories')}
      />
      <Stat
        icon="eye"
        tone="green"
        label={groups ? t('Grupos visibles', 'Visible groups') : t('Categorías visibles', 'Visible categories')}
        value={visible ?? '—'}
        hint={total && visible !== undefined ? `${Math.round((visible / total) * 100)}% ${t('visible', 'visible')}` : undefined}
      />
      <Stat
        icon="eye"
        tone="amber"
        label={groups ? t('Grupos ocultos', 'Hidden groups') : t('Categorías ocultas', 'Hidden categories')}
        value={total !== undefined && visible !== undefined ? total - visible : '—'}
      />
    </div>
  );
}

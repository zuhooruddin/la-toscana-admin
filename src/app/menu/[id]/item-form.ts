import { cleanGroup, slugify } from '@/components/forms';
import { tr } from '@/lib/i18n';
import type { MenuItem } from '@/lib/types';

export type Draft = Omit<MenuItem, '_id' | 'kind'> & { _id?: string; kind?: MenuItem['kind'] };

export const emptyItem = (categoryKey = ''): Draft => ({
  slug: '',
  categoryKey,
  name: { es: '' },
  description: { es: '' },
  priceCents: 0,
  taxRateBps: 1000,
  optionGroups: [],
  sharedGroupKeys: [],
  allergens: [],
  allergensVerified: false,
  tags: [],
  imageUrl: null,
  imageIsPlaceholder: true,
  imageAlt: { es: '' },
  orderable: true,
  orderableNote: { es: '' },
  published: false,
  order: 0,
});

export function validate(d: Draft): string[] {
  const errs: string[] = [];
  if (!d.name.es?.trim()) errs.push(tr('El nombre en español es obligatorio.', 'The Spanish name is required.'));
  if (!d.categoryKey) errs.push(tr('Elige una categoría.', 'Choose a category.'));
  if (d.priceCents < 0) errs.push(tr('El precio no puede ser negativo.', 'The price cannot be negative.'));
  for (const g of d.optionGroups) {
    if (!g.name.es?.trim()) errs.push(tr('Cada grupo de opciones necesita un nombre.', 'Each option group needs a name.'));
    if (g.min > g.max) errs.push(tr(`«${g.name.es}»: el mínimo es mayor que el máximo.`, `“${g.name.es}”: the minimum is greater than the maximum.`));
    if (!g.choices.some((c) => c.name.es?.trim())) errs.push(tr(`«${g.name.es}»: añade al menos una opción.`, `“${g.name.es}”: add at least one option.`));
  }
  return errs;
}

/** Body for POST/PATCH /admin/menu/items (only fields the API accepts). */
export function toBody(d: Draft, isNew: boolean) {
  const loc = (l?: { es?: string; en?: string }) => ({ es: l?.es ?? '', ...(l?.en ? { en: l.en } : {}) });
  return {
    ...(isNew ? { slug: d.slug || slugify(d.name.es ?? '') } : {}),
    categoryKey: d.categoryKey,
    name: loc(d.name),
    description: loc(d.description),
    priceCents: d.priceCents,
    taxRateBps: d.taxRateBps,
    optionGroups: d.optionGroups.map((g) => cleanGroup({ ...g, key: g.key || slugify(g.name.es ?? '') })),
    sharedGroupKeys: d.sharedGroupKeys,
    allergens: d.allergens,
    allergensVerified: d.allergensVerified,
    tags: d.tags,
    imageUrl: d.imageUrl ?? null,
    imageIsPlaceholder: !d.imageUrl,
    imageAlt: loc(d.imageAlt),
    orderable: d.orderable,
    orderableNote: loc(d.orderableNote),
    published: d.published,
    order: d.order,
  };
}

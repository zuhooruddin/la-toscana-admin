/** Admin API shapes (contract 1.3.0, project-docs/api/openapi.v1.json). Raw documents use Mongo `_id`; the API adds `id`. */

export type Role = 'owner' | 'manager' | 'staff' | 'driver' | 'customer';
export type Loc = { es?: string; en?: string };

export interface Me {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: Role;
  branchIds: string[];
  mustChangePassword: boolean;
  lang: string;
}

export interface Interval {
  open: string;
  close: string;
}
export interface DeliveryZone {
  _id?: string;
  name: string;
  postcodes: string[];
  feeCents: number;
  minOrderCents: number;
  etaMinutes: number;
  active: boolean;
}
export interface AdminBranch {
  id: string;
  slug: string;
  name: string;
  imageUrl?: string | null;
  imageAlt?: string;
  published: boolean;
  address: { line1: string; city: string; postcode?: string; province?: string; region?: string; country?: string };
  geo?: { lat?: number; lng?: number };
  contact?: { phone?: string; email?: string; whatsapp?: string; verified?: boolean };
  hours: { day: number; intervals: Interval[] }[];
  hoursVerified: boolean;
  exceptions: { date: string; closed: boolean; intervals?: Interval[]; note?: string }[];
  services: { pickup: boolean; delivery: boolean; dineIn: boolean };
  ordering: { enabled: boolean; paused: boolean; pausedUntil?: string | null; pauseReason?: string; prepTimeMinutes: number; scheduledOrders: boolean };
  delivery: { zones: DeliveryZone[] };
  payments: { cash: boolean; card: boolean };
  drivers?: { requireAccept: boolean };
  reservations: {
    enabled: boolean;
    capacityPerSlot: number;
    slotMinutes: number;
    maxPartySize: number;
    minLeadMinutes: number;
    maxDaysAhead: number;
  };
  seo?: { title?: Loc; description?: Loc };
  notes?: string;
  readiness?: { ordering: string[]; reservations: string[] };
}

export const ORDER_STATUSES = [
  'pending_payment',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'picked_up',
  'delivered',
  'cancelled',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface AdminOrder {
  id: string;
  number: string;
  branchId: string;
  branchName?: string;
  lang?: string;
  customer: { userId?: string; name?: string; phone?: string | null; email?: string | null; anonymised?: boolean };
  fulfilment: {
    type: 'pickup' | 'delivery';
    address?: { line1?: string; line2?: string; postcode?: string; city?: string; notes?: string } | null;
    zoneName?: string;
    scheduledFor?: string | null;
    estimatedReadyAt?: string | null;
  };
  lines: {
    name: string;
    quantity: number;
    options: { groupName?: string; choiceName?: string; priceDeltaCents?: number }[];
    unitPriceCents: number;
    lineTotalCents: number;
    notes?: string;
    warnings?: string[];
  }[];
  totals: { subtotalCents: number; discountCents: number; deliveryFeeCents: number; totalCents: number; taxCents: number };
  coupon?: { code?: string; discountCents?: number } | null;
  payment: {
    method: 'cash' | 'card';
    provider: string;
    simulated: boolean;
    status: string;
    paidAt?: string;
    refundedCents: number;
    refunds?: { amountCents: number; reason: string; status: string; at: string }[];
  };
  status: OrderStatus;
  history: { status: string; at: string; byRole?: string; note?: string }[];
  cancelReason?: string;
  driver?: { userId?: string; name?: string; state?: string; assignedAt?: string; lastLocation?: { lat: number; lng: number; at: string } } | null;
  notes?: string;
  ifSoldOut?: 'contact' | 'substitute' | 'refund_item' | 'cancel_order';
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsSummary {
  range: { from: string; to: string; timezone: string };
  orders: number;
  grossCents: number;
  refundedCents: number;
  netCents: number;
  simulatedCents: number;
  averageTicketCents: number;
  deliveryShare: number;
  byStatus: Record<string, number>;
  byPayment: { method: string; count: number; cents: number }[];
  topItems: { name: string; quantity: number; revenueCents: number }[];
}

export interface Paged<T> {
  items: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  limit?: number;
}

export interface Choice {
  key: string;
  name: Loc;
  priceDeltaCents: number;
  available?: boolean;
  status?: 'active' | 'draft';
  needsConfirmation?: boolean;
  imageUrl?: string;
  sourceText?: string;
}
export interface OptionGroup {
  key: string;
  name: Loc;
  min: number;
  max: number;
  warning?: Loc;
  published?: boolean;
  note?: string;
  maxByChoice?: { groupKey: string; map: Record<string, number> } | null;
  choices: Choice[];
}
export interface Category {
  _id: string;
  key: string;
  name: Loc;
  displayName?: Loc;
  kicker?: Loc;
  description?: Loc;
  order: number;
  published: boolean;
  imageUrl?: string | null;
  imageSource?: string | null;
}
export interface MenuItem {
  _id: string;
  slug: string;
  categoryKey: string;
  kind: 'dish' | 'pasta';
  name: Loc;
  description?: Loc;
  priceCents: number;
  taxRateBps: number;
  optionGroups: OptionGroup[];
  sharedGroupKeys: string[];
  allergens: string[];
  allergensVerified: boolean;
  tags: string[];
  imageUrl?: string | null;
  imageIsPlaceholder?: boolean;
  imageSource?: string | null;
  imageAlt?: Loc;
  orderable: boolean;
  orderableNote?: Loc;
  published: boolean;
  order: number;
  source?: { page?: number; name?: string; price?: string };
  seed?: { sourceId?: string; adminEdited?: boolean };
  updatedAt?: string;
}
export interface ModifierGroupDoc {
  _id: string;
  key: string;
  group: OptionGroup;
  seed?: { sourceId?: string; adminEdited?: boolean };
}
export const ALLERGENS: { key: string; label: string; en: string }[] = [
  { key: 'gluten', label: 'Gluten', en: 'Gluten' },
  { key: 'crustaceans', label: 'Crustáceos', en: 'Crustaceans' },
  { key: 'eggs', label: 'Huevos', en: 'Eggs' },
  { key: 'fish', label: 'Pescado', en: 'Fish' },
  { key: 'peanuts', label: 'Cacahuetes', en: 'Peanuts' },
  { key: 'soybeans', label: 'Soja', en: 'Soybeans' },
  { key: 'milk', label: 'Lácteos', en: 'Milk' },
  { key: 'nuts', label: 'Frutos de cáscara', en: 'Tree nuts' },
  { key: 'celery', label: 'Apio', en: 'Celery' },
  { key: 'mustard', label: 'Mostaza', en: 'Mustard' },
  { key: 'sesame', label: 'Sésamo', en: 'Sesame' },
  { key: 'sulphites', label: 'Sulfitos', en: 'Sulphites' },
  { key: 'lupin', label: 'Altramuces', en: 'Lupin' },
  { key: 'molluscs', label: 'Moluscos', en: 'Molluscs' },
];

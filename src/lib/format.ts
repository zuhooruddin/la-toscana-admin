import { config } from './config';
import { getLang, intlLocale, labels, tr } from './i18n';

export const formatEur = (cents: number | null | undefined) =>
  new Intl.NumberFormat(intlLocale(), { style: 'currency', currency: 'EUR' }).format((cents ?? 0) / 100);

/** "12,50" → 1250. Accepts comma or dot decimals; returns null when not a valid non-negative amount. */
export function parseEur(input: string): number | null {
  const s = input.trim().replace(/\s|€/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}
export const centsToInput = (cents: number | null | undefined) => ((cents ?? 0) / 100).toFixed(2).replace('.', ',');

const tz = config.timezone;
export const formatDateTime = (iso?: string | Date | null) =>
  iso ? new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'short', timeStyle: 'short', timeZone: tz }).format(new Date(iso)) : '—';
export const formatTime = (iso?: string | Date | null) =>
  iso ? new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(iso)) : '—';
export const formatDate = (iso?: string | Date | null) =>
  iso ? new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'medium', timeZone: tz }).format(new Date(iso)) : '—';

/** Today's date (YYYY-MM-DD) in the restaurant's timezone. */
export const todayLocal = (offsetDays = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(Date.now() + offsetDays * 86_400_000));

export function minutesAgo(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 1) return tr('ahora', 'just now');
  if (m < 60) return tr(`hace ${m} min`, `${m} min ago`);
  const h = Math.floor(m / 60);
  return h < 24 ? tr(`hace ${h} h ${m % 60} min`, `${h} h ${m % 60} min ago`) : formatDateTime(iso);
}

export const STATUS_LABEL = labels({
  es: {
    pending_payment: 'Pendiente de pago',
    confirmed: 'Nuevo',
    preparing: 'En preparación',
    ready: 'Listo',
    out_for_delivery: 'En reparto',
    picked_up: 'Recogido',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
    refunded: 'Reembolsado',
  },
  en: {
    pending_payment: 'Awaiting payment',
    confirmed: 'New',
    preparing: 'Preparing',
    ready: 'Ready',
    out_for_delivery: 'Out for delivery',
    picked_up: 'Picked up',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
  },
});
export const STATUS_TONE: Record<string, 'blue' | 'amber' | 'green' | 'grey' | 'red' | 'violet'> = {
  pending_payment: 'grey',
  confirmed: 'blue',
  preparing: 'amber',
  ready: 'green',
  out_for_delivery: 'violet',
  picked_up: 'grey',
  delivered: 'grey',
  cancelled: 'red',
  refunded: 'red',
};
export const PAYMENT_LABEL = labels({
  es: {
    unpaid: 'Pendiente',
    requires_action: 'Requiere acción',
    processing: 'Procesando',
    paid: 'Pagado',
    failed: 'Fallido',
    refund_pending: 'Reembolso pendiente',
    partially_refunded: 'Reembolso parcial',
    refunded: 'Reembolsado',
  },
  en: {
    unpaid: 'Pending',
    requires_action: 'Action required',
    processing: 'Processing',
    paid: 'Paid',
    failed: 'Failed',
    refund_pending: 'Refund pending',
    partially_refunded: 'Partially refunded',
    refunded: 'Refunded',
  },
});
export const IF_SOLD_OUT_LABEL = labels({
  es: {
    contact: 'Contactar con el cliente',
    substitute: 'Seguir la recomendación del restaurante',
    refund_item: 'Quitar ese producto',
    cancel_order: 'Cancelar todo el pedido',
  },
  en: {
    contact: 'Contact the customer',
    substitute: "Follow the restaurant's recommendation",
    refund_item: 'Remove that item',
    cancel_order: 'Cancel the whole order',
  },
});
export const ROLE_LABEL = labels({
  es: {
    owner: 'Propietario',
    manager: 'Encargado',
    staff: 'Personal',
    driver: 'Repartidor',
    customer: 'Cliente',
  },
  en: {
    owner: 'Owner',
    manager: 'Manager',
    staff: 'Staff',
    driver: 'Driver',
    customer: 'Customer',
  },
});
const DAYS_ES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DAYS_EN = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAY_LABEL: string[] = new Proxy(DAYS_ES, {
  get: (t, k) => (typeof k === 'string' && /^\d+$/.test(k) ? (getLang() === 'en' ? DAYS_EN : DAYS_ES)[Number(k)] : Reflect.get(t, k)),
});

/** Next statuses staff can move an order to (mirrors the API transition rules). */
export function nextStatuses(status: string, type: 'pickup' | 'delivery'): string[] {
  switch (status) {
    case 'confirmed':
      return ['preparing'];
    case 'preparing':
      return ['ready'];
    case 'ready':
      return type === 'delivery' ? ['out_for_delivery'] : ['picked_up'];
    case 'out_for_delivery':
      return ['delivered'];
    default:
      return [];
  }
}
export const ACTION_LABEL = labels({
  es: {
    preparing: 'Empezar a preparar',
    ready: 'Marcar como listo',
    picked_up: 'Entregado al cliente',
    out_for_delivery: 'Salió a reparto',
    delivered: 'Marcar entregado',
  },
  en: {
    preparing: 'Start preparing',
    ready: 'Mark as ready',
    picked_up: 'Handed to customer',
    out_for_delivery: 'Out for delivery',
    delivered: 'Mark delivered',
  },
});

/** Human message for an API error, in the active language. */
export function errorText(e: unknown): string {
  const err = e as { code?: string; message?: string; details?: unknown };
  const map: Record<string, string> = {
    NETWORK: tr('No se ha podido conectar con el servidor.', 'Could not connect to the server.'),
    FORBIDDEN: tr('No tienes permiso para esta acción.', 'You do not have permission for this action.'),
    BRANCH_FORBIDDEN: tr('No tienes acceso a este restaurante.', 'You do not have access to this restaurant.'),
    INVALID_CREDENTIALS: tr('Correo o contraseña incorrectos.', 'Incorrect email or password.'),
    ACCOUNT_LOCKED: tr(
      'Cuenta bloqueada temporalmente por intentos fallidos. Inténtalo más tarde.',
      'Account temporarily locked after failed attempts. Try again later.',
    ),
    RATE_LIMITED: tr('Demasiados intentos. Espera un minuto.', 'Too many attempts. Wait a minute.'),
    VALIDATION_FAILED: tr('Revisa los datos del formulario.', 'Check the form data.'),
    ORDERING_NOT_READY: tr('Faltan datos para activar los pedidos online.', 'Some details are missing to enable online ordering.'),
    RESERVATIONS_NOT_READY: tr('Faltan datos para activar las reservas.', 'Some details are missing to enable reservations.'),
    REASON_REQUIRED: tr('Indica el motivo.', 'Enter the reason.'),
    INVALID_TRANSITION: tr('Ese cambio de estado no es posible ahora.', 'That status change is not possible right now.'),
    NOT_STAFF: tr('Esta cuenta no tiene acceso al panel de gestión.', 'This account does not have access to the admin panel.'),
    WEAK_PASSWORD: tr(
      'La contraseña debe tener al menos 10 caracteres, con letras y números.',
      'The password must be at least 10 characters, with letters and numbers.',
    ),
  };
  if (err?.code && map[err.code]) {
    const missing = (err.details as { missing?: string[] } | undefined)?.missing;
    return missing?.length ? `${map[err.code]} (${missing.map(readinessLabel).join(', ')})` : map[err.code];
  }
  if (err?.code === 'VALIDATION_FAILED' || Array.isArray(err?.details)) {
    const d = err.details as { path?: string; message?: string }[] | undefined;
    if (d?.length) return `${tr('Revisa', 'Check')}: ${d.map((x) => `${x.path?.replace(/^body\./, '') ?? ''} ${x.message ?? ''}`.trim()).join('; ')}`;
  }
  return err?.message || tr('Ha ocurrido un error.', 'Something went wrong.');
}

export function readinessLabel(code: string): string {
  return (
    (
      {
        OPENING_HOURS: tr('horario de apertura', 'opening hours'),
        HOURS_NOT_VERIFIED: tr('horario sin verificar', 'unverified hours'),
        CONTACT_NOT_VERIFIED: tr('teléfono sin verificar', 'unverified phone number'),
        NO_FULFILMENT_SERVICE: tr('ni recogida ni reparto activos', 'neither pickup nor delivery enabled'),
        DELIVERY_ZONES: tr('zonas de reparto', 'delivery zones'),
        NO_PAYMENT_METHOD: tr('ningún método de pago', 'no payment method'),
        CAPACITY: tr('capacidad por franja', 'capacity per time slot'),
      } as Record<string, string>
    )[code] ?? code
  );
}

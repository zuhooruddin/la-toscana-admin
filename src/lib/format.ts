import { config } from './config';

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
export const formatEur = (cents: number | null | undefined) => eur.format((cents ?? 0) / 100);

/** "12,50" → 1250. Accepts comma or dot decimals; returns null when not a valid non-negative amount. */
export function parseEur(input: string): number | null {
  const s = input.trim().replace(/\s|€/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}
export const centsToInput = (cents: number | null | undefined) => ((cents ?? 0) / 100).toFixed(2).replace('.', ',');

const tz = config.timezone;
export const formatDateTime = (iso?: string | Date | null) =>
  iso ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: tz }).format(new Date(iso)) : '—';
export const formatTime = (iso?: string | Date | null) =>
  iso ? new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(iso)) : '—';
export const formatDate = (iso?: string | Date | null) =>
  iso ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeZone: tz }).format(new Date(iso)) : '—';

/** Today's date (YYYY-MM-DD) in the restaurant's timezone. */
export const todayLocal = (offsetDays = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(Date.now() + offsetDays * 86_400_000));

export function minutesAgo(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `hace ${h} h ${m % 60} min` : formatDateTime(iso);
}

export const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Pendiente de pago',
  confirmed: 'Nuevo',
  preparing: 'En preparación',
  ready: 'Listo',
  out_for_delivery: 'En reparto',
  picked_up: 'Recogido',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};
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
export const PAYMENT_LABEL: Record<string, string> = {
  unpaid: 'Pendiente',
  requires_action: 'Requiere acción',
  processing: 'Procesando',
  paid: 'Pagado',
  failed: 'Fallido',
  refund_pending: 'Reembolso pendiente',
  partially_refunded: 'Reembolso parcial',
  refunded: 'Reembolsado',
};
export const IF_SOLD_OUT_LABEL: Record<string, string> = {
  contact: 'Contactar con el cliente',
  substitute: 'Seguir la recomendación del restaurante',
  refund_item: 'Quitar ese producto',
  cancel_order: 'Cancelar todo el pedido',
};
export const ROLE_LABEL: Record<string, string> = {
  owner: 'Propietario',
  manager: 'Encargado',
  staff: 'Personal',
  driver: 'Repartidor',
  customer: 'Cliente',
};
export const DAY_LABEL = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

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
export const ACTION_LABEL: Record<string, string> = {
  preparing: 'Empezar a preparar',
  ready: 'Marcar como listo',
  picked_up: 'Entregado al cliente',
  out_for_delivery: 'Salió a reparto',
  delivered: 'Marcar entregado',
};

/** Human message for an API error (Spanish UI). */
export function errorText(e: unknown): string {
  const err = e as { code?: string; message?: string; details?: unknown };
  const map: Record<string, string> = {
    NETWORK: 'No se ha podido conectar con el servidor.',
    FORBIDDEN: 'No tienes permiso para esta acción.',
    BRANCH_FORBIDDEN: 'No tienes acceso a este restaurante.',
    INVALID_CREDENTIALS: 'Correo o contraseña incorrectos.',
    ACCOUNT_LOCKED: 'Cuenta bloqueada temporalmente por intentos fallidos. Inténtalo más tarde.',
    RATE_LIMITED: 'Demasiados intentos. Espera un minuto.',
    VALIDATION_FAILED: 'Revisa los datos del formulario.',
    ORDERING_NOT_READY: 'Faltan datos para activar los pedidos online.',
    RESERVATIONS_NOT_READY: 'Faltan datos para activar las reservas.',
    REASON_REQUIRED: 'Indica el motivo.',
    INVALID_TRANSITION: 'Ese cambio de estado no es posible ahora.',
    NOT_STAFF: 'Esta cuenta no tiene acceso al panel de gestión.',
    WEAK_PASSWORD: 'La contraseña debe tener al menos 10 caracteres, con letras y números.',
  };
  if (err?.code && map[err.code]) {
    const missing = (err.details as { missing?: string[] } | undefined)?.missing;
    return missing?.length ? `${map[err.code]} (${missing.map(readinessLabel).join(', ')})` : map[err.code];
  }
  if (err?.code === 'VALIDATION_FAILED' || Array.isArray(err?.details)) {
    const d = err.details as { path?: string; message?: string }[] | undefined;
    if (d?.length) return `Revisa: ${d.map((x) => `${x.path?.replace(/^body\./, '') ?? ''} ${x.message ?? ''}`.trim()).join('; ')}`;
  }
  return err?.message || 'Ha ocurrido un error.';
}

export function readinessLabel(code: string): string {
  return (
    (
      {
        OPENING_HOURS: 'horario de apertura',
        HOURS_NOT_VERIFIED: 'horario sin verificar',
        CONTACT_NOT_VERIFIED: 'teléfono sin verificar',
        NO_FULFILMENT_SERVICE: 'ni recogida ni reparto activos',
        DELIVERY_ZONES: 'zonas de reparto',
        NO_PAYMENT_METHOD: 'ningún método de pago',
        CAPACITY: 'capacidad por franja',
      } as Record<string, string>
    )[code] ?? code
  );
}

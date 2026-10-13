'use client';

import { useState } from 'react';
import { useFeedback } from '@/components/ui/feedback';
import { Alert, Button, Modal, SelectField, Spinner, TextArea, TextField } from '@/components/ui/kit';
import { api, qs } from '@/lib/api';
import { useBranches } from '@/lib/branch';
import { errorText } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { useT } from '@/lib/i18n';

/** Booking taken by phone: same capacity rules as online bookings (public endpoint, not linked to the staff account). */
export function PhoneBooking({ defaultDate, onClose, onDone }: { defaultDate: string; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const { branches, selected } = useBranches();
  const { toast } = useFeedback();
  const bookable = branches.filter((b) => b.reservations?.enabled);
  const [branchId, setBranchId] = useState(selected !== 'all' && bookable.some((b) => b.id === selected) ? selected : (bookable[0]?.id ?? ''));
  const [date, setDate] = useState(defaultDate);
  const [party, setParty] = useState(2);
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slots = useResource<{ slots: { time: string; available: boolean }[] }>(
    branchId && date ? `/api/v1/reservations/availability${qs({ branch: branchId, date, party })}` : null,
  );

  async function submit() {
    if (!time || name.trim().length < 2 || !/^\+?[0-9 ]{9,16}$/.test(phone.trim())) return setError(t('Completa hora, nombre y un teléfono válido.', 'Fill in time, name and a valid phone number.'));
    setBusy(true);
    setError(null);
    try {
      await api('/api/v1/reservations', {
        method: 'POST',
        body: {
          branchId,
          date,
          time,
          partySize: party,
          name: name.trim(),
          phone: phone.trim(),
          notes: notes.trim() || undefined,
          lang: 'es',
          acceptTerms: true,
        },
      });
      toast(t(`Reserva creada: ${name.trim()}, ${party} pers., ${time}`, `Reservation created: ${name.trim()}, ${party} guests, ${time}`));
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('Nueva reserva por teléfono', 'New phone reservation')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Cancelar', 'Cancel')}
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            {t('Reservar', 'Book')}
          </Button>
        </>
      }
    >
      <div className="stack">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {bookable.length === 0 ? <Alert tone="warning">{t('Ningún restaurante tiene las reservas online activadas.', 'No restaurant has online reservations enabled.')}</Alert> : null}
        <div className="grid-3">
          <SelectField label={t('Restaurante', 'Restaurant')} value={branchId} onChange={(e) => (setBranchId(e.target.value), setTime(''))}>
            {bookable.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </SelectField>
          <TextField label={t('Fecha', 'Date')} type="date" value={date} onChange={(e) => (setDate(e.target.value), setTime(''))} />
          <TextField
            label={t('Personas', 'Guests')}
            type="number"
            min={1}
            max={50}
            value={party}
            onChange={(e) => (setParty(Math.max(1, Number(e.target.value))), setTime(''))}
          />
        </div>
        <div className="field">
          <span>{t('Hora', 'Time')}</span>
          {slots.loading ? (
            <Spinner />
          ) : slots.error ? (
            <Alert tone="warning">{errorText(slots.error)}</Alert>
          ) : (slots.data?.slots ?? []).length === 0 ? (
            <p className="muted">{t('Sin horas disponibles ese día.', 'No times available that day.')}</p>
          ) : (
            <div className="chips">
              {slots.data!.slots.map((s) => (
                <Button key={s.time} size="sm" variant={time === s.time ? 'primary' : 'secondary'} disabled={!s.available} onClick={() => setTime(s.time)}>
                  {s.time}
                </Button>
              ))}
            </div>
          )}
        </div>
        <div className="grid-2">
          <TextField label={t('Nombre', 'Name')} value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField label={t('Teléfono', 'Phone')} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <TextArea label={t('Notas', 'Notes')} value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder={t('Trona, alergias, terraza…', 'High chair, allergies, terrace…')} />
      </div>
    </Modal>
  );
}

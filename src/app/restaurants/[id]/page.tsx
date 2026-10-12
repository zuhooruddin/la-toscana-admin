'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { orderingBadge, ReadinessList } from '@/components/BranchStatus';
import { Icon } from '@/components/ui/Icon';
import { Alert, PageHeader, Spinner, Tabs } from '@/components/ui/kit';
import { useBranches } from '@/lib/branch';
import { errorText } from '@/lib/format';
import type { AdminBranch } from '@/lib/types';
import { useResource } from '@/lib/use-resource';
import { DeliveryTab, GeneralTab, HoursTab, OrderingTab, ReservationsTab } from './sections';

type Tab = 'general' | 'hours' | 'ordering' | 'delivery' | 'reservations';

export default function RestaurantEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { reload: reloadList } = useBranches();
  const r = useResource<{ branch: AdminBranch; readiness: { ordering: string[]; reservations: string[] } }>(`/api/v1/admin/branches/${id}`);
  const [tab, setTab] = useState<Tab>('general');
  if (r.error) return <Alert tone="danger">{errorText(r.error)}</Alert>;
  if (!r.data) return <Spinner />;
  const b = { ...r.data.branch, readiness: r.data.readiness };
  const saved = () => {
    r.reload();
    reloadList();
  };
  const props = { branch: b, onSaved: saved };
  return (
    <>
      <PageHeader
        back={
          <Link href="/restaurants" className="back-link">
            <Icon name="left" size={15} /> Restaurantes
          </Link>
        }
        title={b.name}
        subtitle={
          <span className="row" style={{ gap: 8 }}>
            {orderingBadge(b)} <ReadinessList codes={b.readiness.ordering} />
          </span>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'general', label: 'General y contacto' },
          { value: 'hours', label: 'Horario' },
          { value: 'ordering', label: 'Pedidos y pagos' },
          { value: 'delivery', label: 'Reparto' },
          { value: 'reservations', label: 'Reservas' },
        ]}
      />
      {tab === 'general' ? <GeneralTab key={`g${b.id}`} {...props} /> : null}
      {tab === 'hours' ? <HoursTab key={`h${b.id}`} {...props} /> : null}
      {tab === 'ordering' ? <OrderingTab key={`o${b.id}`} {...props} /> : null}
      {tab === 'delivery' ? <DeliveryTab key={`d${b.id}`} {...props} /> : null}
      {tab === 'reservations' ? <ReservationsTab key={`r${b.id}`} {...props} /> : null}
    </>
  );
}

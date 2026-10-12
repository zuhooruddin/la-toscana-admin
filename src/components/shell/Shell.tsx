'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { BranchProvider, useBranches } from '@/lib/branch';
import { ROLE_LABEL } from '@/lib/format';
import { RealtimeProvider, useRealtime } from '@/lib/realtime';
import { Icon, type IconName } from '../ui/Icon';

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  perm?: string;
  badge?: 'orders';
}
const NAV: { section?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: '/', label: 'Panel', icon: 'dashboard' },
      { href: '/orders', label: 'Pedidos', icon: 'orders', perm: 'orders:read', badge: 'orders' },
      { href: '/reservations', label: 'Reservas', icon: 'calendar', perm: 'reservations:read' },
    ],
  },
  {
    section: 'Carta',
    items: [
      { href: '/menu', label: 'Productos', icon: 'menu', perm: 'menu:read' },
      { href: '/menu/categories', label: 'Categorías', icon: 'layers', perm: 'menu:read' },
      { href: '/menu/modifiers', label: 'Extras y opciones', icon: 'plus', perm: 'menu:read' },
      { href: '/availability', label: 'Disponibilidad', icon: 'toggle', perm: 'menu:availability' },
    ],
  },
  {
    section: 'Negocio',
    items: [
      { href: '/restaurants', label: 'Restaurantes', icon: 'store', perm: 'branch:read' },
      { href: '/customers', label: 'Clientes', icon: 'users', perm: 'customers:read' },
      { href: '/drivers', label: 'Repartidores', icon: 'truck', perm: 'drivers:read' },
      { href: '/promotions', label: 'Promociones', icon: 'tag', perm: 'promotions:read' },
      { href: '/reports', label: 'Informes', icon: 'euro', perm: 'analytics:read' },
    ],
  },
  {
    section: 'Web y apps',
    items: [
      { href: '/content/banners', label: 'Banners', icon: 'image', perm: 'content:read' },
      { href: '/content/pages', label: 'Páginas', icon: 'file', perm: 'content:read' },
      { href: '/content/redirects', label: 'Redirecciones', icon: 'link', perm: 'content:read' },
      { href: '/content/translations', label: 'Textos', icon: 'translate', perm: 'translations:write' },
    ],
  },
  {
    section: 'Administración',
    items: [
      { href: '/staff', label: 'Equipo y permisos', icon: 'shield', perm: 'staff:read' },
      { href: '/settings', label: 'Ajustes', icon: 'settings', perm: 'settings:read' },
      { href: '/audit', label: 'Registro de actividad', icon: 'history', perm: 'audit:read' },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  if (href === '/menu') return pathname === '/menu' || /^\/menu\/(?!categories|modifiers)/.test(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname() ?? '/';
  const { can, logout } = useAuth();
  const { unseen } = useRealtime();
  return (
    <aside className="sidebar" aria-label="Navegación del panel">
      <Link href="/" className="side-brand" onClick={onNavigate}>
        <span className="logo" aria-hidden="true">
          LT
        </span>
        <span>
          <strong>La Toscana</strong>
          <small>Panel de gestión</small>
        </span>
      </Link>
      <nav>
        {NAV.map((group, gi) => {
          const items = group.items.filter((i) => !i.perm || can(i.perm));
          if (!items.length) return null;
          return (
            <div key={gi}>
              {group.section ? <p className="side-section">{group.section}</p> : null}
              {items.map((i) => (
                <Link key={i.href} href={i.href} className="side-link" aria-current={isActive(pathname, i.href) ? 'page' : undefined} onClick={onNavigate}>
                  <Icon name={i.icon} />
                  {i.label}
                  {i.badge === 'orders' && unseen.length ? (
                    <span className="count" aria-label={`${unseen.length} pedidos nuevos`}>
                      {unseen.length}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="side-foot">
        <Link href="/account" className="side-link" aria-current={pathname === '/account' ? 'page' : undefined} onClick={onNavigate}>
          <Icon name="user" />
          Mi cuenta
        </Link>
        <button type="button" className="side-link" style={{ border: 0, background: 'none', width: '100%', cursor: 'pointer' }} onClick={() => void logout()}>
          <Icon name="logout" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { me } = useAuth();
  const { branches, selected, select } = useBranches();
  const { connected, sound, setSound } = useRealtime();
  return (
    <header className="topbar">
      <button type="button" className="icon-btn menu-btn" onClick={onMenu} aria-label="Abrir menú">
        <Icon name="bars" />
      </button>
      {branches.length > 1 ? (
        <label className="row" style={{ gap: 8 }}>
          <Icon name="store" />
          <span className="sr-only">Restaurante</span>
          <select className="input" style={{ width: 'auto', minWidth: 200 }} value={selected} onChange={(e) => select(e.target.value)}>
            {me?.role === 'owner' || branches.length > 1 ? <option value="all">Todos los restaurantes</option> : null}
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      ) : branches[0] ? (
        <span className="row" style={{ gap: 8, fontWeight: 700 }}>
          <Icon name="store" />
          {branches[0].name}
        </span>
      ) : null}
      <span className="spacer" />
      <span
        className="live-dot"
        data-on={connected}
        title={connected ? 'Recibiendo pedidos en directo' : 'Sin conexión en directo: la página se actualiza al recargar'}
      >
        {connected ? 'En directo' : 'Sin directo'}
      </span>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setSound(!sound)}
        aria-pressed={sound}
        aria-label={sound ? 'Silenciar aviso de pedidos nuevos' : 'Activar aviso sonoro de pedidos nuevos'}
        title={sound ? 'Aviso sonoro activado' : 'Aviso sonoro desactivado'}
      >
        <Icon name="bell" />
      </button>
      <div className="who">
        <strong>{me?.name || me?.email}</strong>
        <small>{ROLE_LABEL[me?.role ?? ''] ?? me?.role}</small>
      </div>
    </header>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  return (
    <BranchProvider>
      <RealtimeProvider>
        <div className="shell" data-nav={navOpen ? 'open' : 'closed'} onClick={(e) => navOpen && e.target === e.currentTarget && setNavOpen(false)}>
          <Sidebar onNavigate={() => setNavOpen(false)} />
          <div className="main">
            <Topbar onMenu={() => setNavOpen(true)} />
            <main className="content" id="main">
              {children}
            </main>
          </div>
        </div>
      </RealtimeProvider>
    </BranchProvider>
  );
}

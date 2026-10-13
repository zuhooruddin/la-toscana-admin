'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { BranchProvider, useBranches } from '@/lib/branch';
import { ROLE_LABEL } from '@/lib/format';
import { LangSwitch, useT } from '@/lib/i18n';
import { RealtimeProvider, useRealtime } from '@/lib/realtime';
import { Icon, type IconName } from '../ui/Icon';

interface NavItem {
  href: string;
  label: [string, string];
  icon: IconName;
  perm?: string;
  badge?: 'orders';
}
const NAV: { section?: [string, string]; items: NavItem[] }[] = [
  {
    items: [
      { href: '/', label: ['Panel', 'Dashboard'], icon: 'dashboard' },
      { href: '/orders', label: ['Pedidos', 'Orders'], icon: 'orders', perm: 'orders:read', badge: 'orders' },
      { href: '/reservations', label: ['Reservas', 'Reservations'], icon: 'calendar', perm: 'reservations:read' },
    ],
  },
  {
    section: ['Carta', 'Menu'],
    items: [
      { href: '/menu', label: ['Productos', 'Products'], icon: 'menu', perm: 'menu:read' },
      { href: '/menu/categories', label: ['Categorías', 'Categories'], icon: 'layers', perm: 'menu:read' },
      { href: '/menu/modifiers', label: ['Extras y opciones', 'Extras & options'], icon: 'plus', perm: 'menu:read' },
      { href: '/availability', label: ['Disponibilidad', 'Availability'], icon: 'toggle', perm: 'menu:availability' },
    ],
  },
  {
    section: ['Negocio', 'Business'],
    items: [
      { href: '/restaurants', label: ['Restaurantes', 'Restaurants'], icon: 'store', perm: 'branch:read' },
      { href: '/customers', label: ['Clientes', 'Customers'], icon: 'users', perm: 'customers:read' },
      { href: '/drivers', label: ['Repartidores', 'Drivers'], icon: 'truck', perm: 'drivers:read' },
      { href: '/promotions', label: ['Promociones', 'Promotions'], icon: 'tag', perm: 'promotions:read' },
      { href: '/reports', label: ['Informes', 'Reports'], icon: 'euro', perm: 'analytics:read' },
    ],
  },
  {
    section: ['Web y apps', 'Web & apps'],
    items: [
      { href: '/content/banners', label: ['Banners', 'Banners'], icon: 'image', perm: 'content:read' },
      { href: '/content/pages', label: ['Páginas', 'Pages'], icon: 'file', perm: 'content:read' },
      { href: '/content/redirects', label: ['Redirecciones', 'Redirects'], icon: 'link', perm: 'content:read' },
      { href: '/content/translations', label: ['Textos', 'Texts'], icon: 'translate', perm: 'translations:write' },
    ],
  },
  {
    section: ['Administración', 'Administration'],
    items: [
      { href: '/staff', label: ['Equipo y permisos', 'Team & permissions'], icon: 'shield', perm: 'staff:read' },
      { href: '/settings', label: ['Ajustes', 'Settings'], icon: 'settings', perm: 'settings:read' },
      { href: '/audit', label: ['Registro de actividad', 'Activity log'], icon: 'history', perm: 'audit:read' },
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
  const t = useT();
  return (
    <aside className="sidebar" aria-label={t('Navegación del panel', 'Panel navigation')}>
      <Link href="/" className="side-brand" onClick={onNavigate}>
        <span className="logo" aria-hidden="true">
          LT
        </span>
        <span>
          <strong>La Toscana</strong>
          <small>{t('Panel de gestión', 'Admin panel')}</small>
        </span>
      </Link>
      <nav>
        {NAV.map((group, gi) => {
          const items = group.items.filter((i) => !i.perm || can(i.perm));
          if (!items.length) return null;
          return (
            <div key={gi}>
              {group.section ? <p className="side-section">{t(...group.section)}</p> : null}
              {items.map((i) => (
                <Link key={i.href} href={i.href} className="side-link" aria-current={isActive(pathname, i.href) ? 'page' : undefined} onClick={onNavigate}>
                  <Icon name={i.icon} />
                  {t(...i.label)}
                  {i.badge === 'orders' && unseen.length ? (
                    <span className="count" aria-label={t(`${unseen.length} pedidos nuevos`, `${unseen.length} new orders`)}>
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
          {t('Mi cuenta', 'My account')}
        </Link>
        <button type="button" className="side-link" style={{ border: 0, background: 'none', width: '100%', cursor: 'pointer' }} onClick={() => void logout()}>
          <Icon name="logout" />
          {t('Cerrar sesión', 'Log out')}
        </button>
      </div>
    </aside>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { me } = useAuth();
  const { branches, selected, select } = useBranches();
  const { connected, sound, setSound } = useRealtime();
  const t = useT();
  return (
    <header className="topbar">
      <button type="button" className="icon-btn menu-btn" onClick={onMenu} aria-label={t('Abrir menú', 'Open menu')}>
        <Icon name="bars" />
      </button>
      {branches.length > 1 ? (
        <label className="row" style={{ gap: 8 }}>
          <Icon name="store" />
          <span className="sr-only">{t('Restaurante', 'Restaurant')}</span>
          <select className="input" style={{ width: 'auto', minWidth: 200 }} value={selected} onChange={(e) => select(e.target.value)}>
            {me?.role === 'owner' || branches.length > 1 ? <option value="all">{t('Todos los restaurantes', 'All restaurants')}</option> : null}
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
        title={
          connected
            ? t('Recibiendo pedidos en directo', 'Receiving orders live')
            : t('Sin conexión en directo: la página se actualiza al recargar', 'No live connection: the page updates on reload')
        }
      >
        {connected ? t('En directo', 'Live') : t('Sin directo', 'Offline')}
      </span>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setSound(!sound)}
        aria-pressed={sound}
        aria-label={
          sound ? t('Silenciar aviso de pedidos nuevos', 'Mute new-order alert') : t('Activar aviso sonoro de pedidos nuevos', 'Enable new-order sound alert')
        }
        title={sound ? t('Aviso sonoro activado', 'Sound alert on') : t('Aviso sonoro desactivado', 'Sound alert off')}
      >
        <Icon name="bell" />
      </button>
      <LangSwitch />
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

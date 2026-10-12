# La Toscana — admin dashboard

Back-office for La Toscana Pizzeria (Next.js 16, React 19). It uses the same backend API and database as the website and the
mobile apps (`la-toscana-backend`, `/api/v1`), with live order updates over Socket.IO.

## Modules

| Area                  | What staff can do                                                                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel                 | Today's orders, sales, average ticket, orders in progress, pause/resume online ordering per restaurant                                                                                                               |
| Pedidos               | Live kitchen board (new → preparing → ready → out for delivery/picked up), history with filters, order detail: status, cancel with reason, assign driver, refunds (card via provider, cash recorded), kitchen ticket |
| Reservas              | Day view, seated / no-show / cancel, bookings taken by phone (same capacity rules)                                                                                                                                   |
| Carta                 | Products (names es/en, price, VAT, photo, allergens, visibility, options), categories (with image), shared extras, per-restaurant availability, sold-out and price overrides                                         |
| Restaurantes          | Address, contact, weekly hours and closures, online ordering and scheduled orders, services, payment methods, delivery zones, bookings                                                                               |
| Clientes              | Search, order history, block/unblock, GDPR erasure (owner)                                                                                                                                                           |
| Repartidores / Equipo | Accounts with one-time passwords, roles and restaurants                                                                                                                                                              |
| Promociones           | Discount codes (percent/fixed, minimums, dates, limits, restaurants)                                                                                                                                                 |
| Informes              | Sales by date range, top products, payment methods, CSV export                                                                                                                                                       |
| Web y apps            | Banners (home slider, app promo…), pages (draft/publish, legal review flag), redirects, UI texts es/en                                                                                                               |
| Ajustes               | Business identity, tax data, social links, app-store links, SEO, GA4, cookie notice, encrypted integration keys                                                                                                      |
| Registro de actividad | Read-only audit log                                                                                                                                                                                                  |

## Security

- Session in httpOnly cookies on the API host; CSRF header on every write; one silent refresh on 401.
- Only `owner`, `manager` and `staff` accounts can sign in. Temporary passwords must be changed on first login.
- The UI hides what a role cannot do (permissions come from `/auth/me`); **the API enforces every permission and branch scope**.
- Strict CSP, `X-Frame-Options: DENY`, `noindex`. No secrets in the bundle: integration keys are write-only and encrypted on the server;
  Stripe keys live only in the server environment.

## Development

```bash
cp .env.example .env.local      # NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WEBSITE_URL
npm install
npm run dev                     # http://localhost:3200
```

The backend's `CORS_ORIGINS` must include the dashboard origin (e.g. `http://localhost:3200`). For a local playground without touching
real data: `npm run dev:memory -- --demo` in the backend (in-memory DB, demo users `staff@dev.invalid` / `driver@dev.invalid`).

Checks: `npm run typecheck`, `npm run lint`, `npm run build`.

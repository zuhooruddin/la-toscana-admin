/** Public configuration (build-time env). No secrets ever live in the dashboard bundle. */
export const config = {
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, ''),
  websiteUrl: (process.env.NEXT_PUBLIC_WEBSITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  /** Contract the dashboard was built against (project-docs/api/openapi.v1.json). */
  apiContractVersion: '1.3.0',
  timezone: 'Europe/Madrid',
};

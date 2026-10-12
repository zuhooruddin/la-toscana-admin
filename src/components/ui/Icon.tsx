/** Stroke icons on a 24px grid. Decorative unless a label is given. */
const PATHS = {
  dashboard: 'M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 9h8V3h-8z',
  orders: 'M6 2h12l2 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6zM4 6h16M9 11h6M9 15h6',
  menu: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-1.7 1.3-2.5 3.5-2.5 6.5H17V21',
  layers: 'm12 3 9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  toggle: 'M8 7h8a5 5 0 0 1 0 10H8A5 5 0 0 1 8 7zM16 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  store: 'M4 9h16l-1-5H5zM4 9v11h16V9M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M10 20v-5h4v5',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c1-4 3.8-6 7-6s6 2 7 6M16 3.5a4 4 0 0 1 0 7M18 15c2 .8 3.3 2.8 4 6',
  user: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6',
  truck: 'M3 6h11v10H3zM14 9h4l3 4v3h-7M7 18.5a1.5 1.5 0 1 0 0 .01M17 18.5a1.5 1.5 0 1 0 0 .01',
  tag: 'M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM7.5 7.5h.01',
  file: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8',
  image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5a1.5 1.5 0 1 0 0-.01',
  shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM9 12l2 2 4-4',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'm5 12 4.5 4.5L19 7',
  chevron: 'm6 9 6 6 6-6',
  right: 'm9 6 6 6-6 6',
  left: 'm15 6-6 6 6 6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  print: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z',
  refresh: 'M20 11a8 8 0 0 0-14.9-3.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.9 3.9L20 16M20 20v-4h-4',
  pause: 'M8 5v14M16 5v14',
  play: 'M7 4v16l13-8z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  pin: 'M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  euro: 'M18 6.5A7 7 0 1 0 18 17.5M4 10h10M4 14h10',
  alert: 'M12 3 2 21h20zM12 10v5M12 18h.01',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  bag: 'M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2',
  card: 'M3 6h18v12H3zM3 10h18M7 15h3',
  cash: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6 10v4M18 10v4',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9S14.5 18.5 12 21c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3z',
  key: 'M15 7a4 4 0 1 1-3.9 5H3v3h3v3h3v-3h2.1A4 4 0 0 1 15 7zM16 10h.01',
  bars: 'M4 6h16M4 12h16M4 18h16',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  link: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  translate: 'M4 5h8M8 3v2M6 5c0 4 2 7 5 8M10 5c0 4-2 7-6 9M13 21l4-10 4 10M14.5 17.5h5',
  bell: 'M6 9a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 21h4',
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 18,
  label,
  className,
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  label?: string;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      className={className ? `ico ${className}` : 'ico'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

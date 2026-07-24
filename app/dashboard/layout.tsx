'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import ThemeToggle from '../components/ThemeToggle';
import BrandMark from '../components/BrandMark';

type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

// Cinco destinos principales para la tab bar móvil; el resto vive en el sheet
// de "Más". En escritorio el sidebar los muestra todos.
const PRIMARY: NavItem[] = [
  { href: '/dashboard', label: 'Resumen', icon: 'home' },
  { href: '/dashboard/earnings', label: 'Ingresos', icon: 'chart' },
  { href: '/dashboard/subscribers', label: 'Suscriptores', icon: 'people' },
  { href: '/dashboard/content', label: 'Contenido', icon: 'grid' },
];

const SECONDARY: NavItem[] = [
  { href: '/dashboard/plans', label: 'Planes', icon: 'tag' },
  { href: '/dashboard/courses', label: 'Cursos', icon: 'book' },
  { href: '/dashboard/services', label: 'Servicios', icon: 'wrench' },
  { href: '/dashboard/keys', label: 'API Keys', icon: 'key' },
  { href: '/dashboard/settings', label: 'Ajustes', icon: 'gear' },
];

const ALL = [...PRIMARY, ...SECONDARY];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href: string) => pathname === href;
  // "Más" queda resaltado cuando la ruta activa es uno de sus destinos.
  const moreActive = SECONDARY.some((i) => isActive(i.href));

  return (
    <div className="flex min-h-screen">
      {/* Sidebar solo en escritorio. */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sep bg-surface p-4 lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-semibold text-ink">
          <BrandMark className="h-6 w-6" />
          Contenline
        </Link>
        <nav className="flex flex-col gap-1">
          {ALL.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={`rounded-control px-3 py-2 text-sm transition-colors ${
                isActive(item.href)
                  ? 'bg-sep text-ink'
                  : 'text-muted hover:bg-surface hover:text-ink'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="glass glass-header sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-sep px-4 py-3 lg:justify-end">
          <Link href="/" className="flex items-center gap-2 font-semibold text-ink lg:hidden">
            <BrandMark className="h-6 w-6" />
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <ConnectButton showBalance={false} />
          </div>
        </header>

        {/* pb extra en móvil para que la tab bar fija no tape el contenido. */}
        <main className="flex-1 p-4 pb-28 sm:p-6 lg:pb-6">{children}</main>
      </div>

      {/* Tab bar inferior de cristal, solo móvil/tablet. */}
      <nav
        className="glass fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-sep lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Navegación principal"
      >
        {PRIMARY.map((item) => (
          <TabLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={`flex min-h-[44px] flex-col items-center justify-center gap-1 py-2 text-[11px] ${
            moreActive ? 'text-ink' : 'text-muted'
          }`}
        >
          <Icon name="more" />
          Más
        </button>
      </nav>

      {/* Sheet de "Más". */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Más destinos"
          onClick={() => setMoreOpen(false)}
        >
          <div className="absolute inset-0 bg-black/45" aria-hidden />
          <div
            className="glass relative w-full rounded-t-sheet border-t border-sep p-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-pill bg-sep" aria-hidden />
            <div className="grid grid-cols-1 gap-1">
              {SECONDARY.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={`flex min-h-[44px] items-center gap-3 rounded-control px-3 text-sm ${
                    isActive(item.href) ? 'bg-sep text-ink' : 'text-ink'
                  }`}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-[44px] flex-col items-center justify-center gap-1 py-2 text-[11px] ${
        active ? 'text-ink' : 'text-muted'
      }`}
    >
      <Icon name={item.icon} />
      {item.label}
    </Link>
  );
}

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

const ICONS = {
  home: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M4 20h16" />,
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 6.5a3 3 0 0 1 0 6M20.5 20a5.5 5.5 0 0 0-3-4.9" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V4h8l9 9-8 8-9-9z" />
      <circle cx="7.5" cy="7.5" r="1" />
    </>
  ),
  book: <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 1 2-2h13" />,
  wrench: <path d="M14.5 6a3.5 3.5 0 0 0-4.9 4.4L3 17v3h3l6.6-6.6A3.5 3.5 0 0 0 18 8.5L15.5 11 13 8.5 15.5 6z" />,
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="3.5" />
      <path d="M10 13 20 3M17 6l2 2M14 9l2 2" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </>
  ),
} as const;

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAuthSync } from '@/lib/useAuthSync';

const NAV = [
  { href: '/dashboard', label: 'Resumen' },
  { href: '/dashboard/earnings', label: 'Ingresos' },
  { href: '/dashboard/plans', label: 'Planes' },
  { href: '/dashboard/courses', label: 'Cursos' },
  { href: '/dashboard/services', label: 'Servicios' },
  { href: '/dashboard/content', label: 'Contenido' },
  { href: '/dashboard/keys', label: 'API Keys' },
  { href: '/dashboard/settings', label: 'Ajustes' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Cierra la sesión si la wallet conectada deja de coincidir con la de la cookie.
  useAuthSync();

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-surface-border p-4 flex flex-col">
        <Link href="/" className="text-lg font-bold mb-8">
          Conten<span className="text-brand">line</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm ${
                  active ? 'bg-brand text-white' : 'text-white/60 hover:bg-surface-border/40'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-surface-border px-6 py-3">
          <ConnectButton showBalance={false} />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

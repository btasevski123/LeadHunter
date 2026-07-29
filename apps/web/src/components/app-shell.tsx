'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  Crosshair,
  Download,
  LayoutDashboard,
  Radio,
  Settings,
  Target,
  Workflow,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/sources', label: 'Sources', icon: Radio },
  { href: '/imports', label: 'Imports', icon: Download },
  { href: '/top-leads', label: 'Top Leads', icon: Crosshair },
  { href: '/outreach', label: 'Outreach', icon: Workflow },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(15,118,110,0.10),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(14,165,233,0.07),_transparent_45%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(45,212,191,0.08),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(14,165,233,0.06),_transparent_45%)]" />
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-border/70 bg-card/50 backdrop-blur-md md:flex md:flex-col">
          <div className="flex items-center gap-3 border-b border-border/70 px-5 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-sm ring-1 ring-primary/20">
              <Target className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <div className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
                LeadHunter
              </div>
              <div className="text-xs text-muted-foreground">MK · Lead Intelligence</div>
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Main">
            {nav.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150',
                    active
                      ? 'bg-primary/15 font-medium text-primary shadow-sm ring-1 ring-primary/15'
                      : 'text-muted-foreground hover:bg-accent/80 hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-border/70 p-4 text-xs text-muted-foreground">
            Discover · Audit · Convert
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/70 bg-background/75 px-4 py-3 backdrop-blur-md md:px-8">
            <div className="font-[family-name:var(--font-display)] text-lg font-semibold md:hidden">
              LeadHunter MK
            </div>
            <div className="hidden text-sm text-muted-foreground md:block">
              North Macedonia business opportunity radar
            </div>
            <ThemeToggle />
          </header>
          <nav
            className="flex gap-2 overflow-x-auto border-b border-border/70 px-4 py-2 md:hidden"
            aria-label="Mobile"
          >
            {nav.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'cursor-pointer whitespace-nowrap rounded-md px-3 py-1.5 text-xs transition-colors',
                    active
                      ? 'bg-primary/15 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

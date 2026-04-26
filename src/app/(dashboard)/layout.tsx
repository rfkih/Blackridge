'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { IpWhitelistBanner } from '@/components/layout/IpWhitelistBanner';
import { useWebSocket } from '@/hooks/useWebSocket';

function DashboardShell({ children }: { children: React.ReactNode }) {
  useWebSocket();

  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div
      className="mm flex h-screen overflow-hidden"
      style={{ background: 'var(--mm-bg)', color: 'var(--mm-ink-0)' }}
    >
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav
          onMenuClick={() => setSidebarOpen(true)}
          onCommandOpen={() => setPaletteOpen(true)}
        />
        <IpWhitelistBanner />
        <main
          key={pathname}
          className="page-enter flex-1 overflow-y-auto"
          style={{
            padding: '24px 28px 24px 0',
            color: 'var(--mm-ink-0)',
            // Hint the compositor — cheaper opacity/transform transitions on
            // the top-level main during route animation.
            willChange: 'opacity, transform',
          }}
        >
          {children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}

'use client';

import { useEffect, useState } from 'react';
import { Loader2, WifiOff } from 'lucide-react';
import { useWsStore } from '@/store/wsStore';

const SHOW_AFTER_MS = 3_000;

// Louder companion to the TopNav pulse pill — the pill is easy to miss
// when actively monitoring P&L. STOMP auto-reconnects every 5 s, so no
// manual retry is offered.
export function WsReconnectingBanner() {
  const connected = useWsStore((s) => s.connected);
  const reconnecting = useWsStore((s) => s.reconnecting);
  const [show, setShow] = useState(false);

  // Deps are connected-only: the STOMP client cycles `reconnecting` true/false
  // while a disconnect persists, and including it would reset the 3 s timer
  // every cycle — the banner could then never fire on a flaky network.
  useEffect(() => {
    if (connected) {
      setShow(false);
      return;
    }
    const id = window.setTimeout(() => setShow(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [connected]);

  if (!show || connected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        margin: '0 0 12px',
        padding: '10px 14px',
        borderRadius: 10,
        border: '1px solid rgba(245,166,35,0.32)',
        background: 'rgba(245,166,35,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 12,
        color: 'var(--mm-ink-1)',
      }}
    >
      {reconnecting ? (
        <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-warning)' }} />
      ) : (
        <WifiOff size={14} style={{ color: 'var(--color-warning)' }} />
      )}
      <span>
        {reconnecting ? (
          <>
            <strong style={{ color: 'var(--color-warning)' }}>Reconnecting\u2026</strong> live P&amp;L
            and order updates are paused. Existing positions are unaffected on the exchange.
          </>
        ) : (
          <>
            <strong style={{ color: 'var(--color-warning)' }}>Offline.</strong> The browser cannot
            reach the live updates feed. Check your network connection.
          </>
        )}
      </span>
    </div>
  );
}

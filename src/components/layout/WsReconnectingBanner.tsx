'use client';

import { useEffect, useState } from 'react';
import { Loader2, RotateCw, WifiOff } from 'lucide-react';
import { useWsStore } from '@/store/wsStore';
import { retryStompClient } from '@/lib/ws/stompClient';

const SHOW_AFTER_MS = 3_000;

export function WsReconnectingBanner() {
  const connected = useWsStore((s) => s.connected);
  const reconnecting = useWsStore((s) => s.reconnecting);
  const permanent = useWsStore((s) => s.permanentlyDisconnected);
  const attempts = useWsStore((s) => s.reconnectAttempts);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (connected) {
      setShow(false);
      return;
    }
    if (permanent) {
      setShow(true);
      return;
    }
    const id = window.setTimeout(() => setShow(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [connected, permanent]);

  if (!show || connected) return null;

  const tone = permanent ? 'var(--color-loss)' : 'var(--color-warning)';
  const bg = permanent ? 'rgba(229,72,77,0.08)' : 'rgba(245,166,35,0.08)';
  const border = permanent ? 'rgba(229,72,77,0.32)' : 'rgba(245,166,35,0.32)';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        margin: '0 0 12px',
        padding: '12px 16px',
        borderRadius: 14,
        border: `1px solid ${border}`,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 14,
        color: 'var(--mm-ink-1)',
      }}
    >
      {permanent ? (
        <WifiOff size={14} style={{ color: tone }} />
      ) : reconnecting ? (
        <Loader2 size={14} className="animate-spin" style={{ color: tone }} />
      ) : (
        <WifiOff size={14} style={{ color: tone }} />
      )}
      <span style={{ flex: 1 }}>
        {permanent ? (
          <>
            <strong style={{ color: tone }}>Disconnected.</strong> Live updates stopped after{' '}
            {attempts} retries. Existing positions are unaffected on the exchange — click retry to
            reconnect.
          </>
        ) : reconnecting ? (
          <>
            <strong style={{ color: tone }}>Reconnecting…</strong> live P&amp;L and order updates
            are paused (attempt {attempts}). Existing positions are unaffected on the exchange.
          </>
        ) : (
          <>
            <strong style={{ color: tone }}>Offline.</strong> The browser cannot reach the live
            updates feed. Check your network connection.
          </>
        )}
      </span>
      {permanent && (
        <button
          type="button"
          onClick={() => retryStompClient()}
          className="mm-pill"
          style={{
            padding: '6px 12px',
            fontSize: 13,
            color: tone,
            borderColor: border,
            background: 'transparent',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <RotateCw size={12} />
          Retry connection
        </button>
      )}
    </div>
  );
}

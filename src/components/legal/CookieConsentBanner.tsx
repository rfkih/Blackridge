'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

const STORAGE_KEY = 'blackheart:cookie-consent';

type Decision = 'accepted' | 'declined';

// Informational only — we don't run advertising/analytics. Hydration-safe
// because the initial undefined state renders null until the effect reads
// localStorage on the client.
export function CookieConsentBanner() {
  const [decision, setDecision] = useState<Decision | null | undefined>(undefined);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === 'accepted' || raw === 'declined') {
        setDecision(raw);
      } else {
        setDecision(null);
      }
    } catch {
      setDecision(null);
    }
  }, []);

  const decide = (next: Decision) => {
    setDecision(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage may be disabled (Safari private mode); no further action.
    }
  };

  if (decision === undefined || decision !== null) return null;

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 60,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          maxWidth: 640,
          width: '100%',
          padding: '14px 18px',
          borderRadius: 12,
          background: 'var(--mm-surface-2)',
          border: '1px solid var(--mm-hair-2)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 280px', fontSize: 12, color: 'var(--mm-ink-1)', lineHeight: 1.5 }}>
          We use a session signal cookie + a few localStorage entries for sign-in and preferences.{' '}
          <Link href="/cookies" style={{ color: 'var(--mm-mint)', textDecoration: 'underline' }}>
            Read what we use
          </Link>
          . No advertising or analytics trackers.
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="mm-btn"
            onClick={() => decide('declined')}
            style={{ fontSize: 11, padding: '6px 12px' }}
          >
            Decline
          </button>
          <button
            type="button"
            className="mm-btn mm-btn-mint"
            onClick={() => decide('accepted')}
            style={{ fontSize: 11, padding: '6px 12px' }}
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => decide('declined')}
            aria-label="Dismiss cookie notice"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--mm-ink-3)',
              cursor: 'pointer',
              padding: 4,
              display: 'inline-flex',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

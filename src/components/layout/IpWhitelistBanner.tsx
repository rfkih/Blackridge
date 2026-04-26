'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Copy, X } from 'lucide-react';
import { useServerIpStatus } from '@/hooks/useServerIp';
import { toast } from '@/hooks/useToast';

const DISMISS_KEY = 'blackheart:ip-whitelist-dismissed-ip';

/**
 * Top-of-dashboard warning that fires when the IP_MONITOR scheduler records
 * a CHANGED event — the server's outbound IP shifted and any Binance API
 * key restricted to the previous IP will start rejecting trades. Dismissal
 * is keyed by the new IP itself so a *future* change re-warns the user.
 */
export function IpWhitelistBanner() {
  const { data } = useServerIpStatus();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  // Hydrate dismissal from localStorage on mount. Doing this in an effect
  // (not at useState init) keeps SSR output stable.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDismissedFor(window.localStorage.getItem(DISMISS_KEY));
  }, []);

  if (!data || data.event !== 'CHANGED' || !data.currentIp) return null;
  if (dismissedFor === data.currentIp) return null;

  const handleCopy = async () => {
    if (!data.currentIp || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(data.currentIp);
      toast.success({ title: 'IP copied to clipboard' });
    } catch {
      toast.error({ title: 'Copy failed' });
    }
  };

  const handleDismiss = () => {
    if (typeof window !== 'undefined' && data.currentIp) {
      window.localStorage.setItem(DISMISS_KEY, data.currentIp);
    }
    setDismissedFor(data.currentIp);
  };

  return (
    <div
      role="alert"
      className="flex items-start gap-3 border-b border-bd-subtle bg-tint-warning px-5 py-2.5"
    >
      <AlertTriangle
        size={14}
        strokeWidth={1.75}
        className="mt-0.5 shrink-0 text-warning"
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[12px] text-text-primary">
          <span className="font-semibold">Server IP changed.</span>{' '}
          Binance API keys whitelisted to the previous IP will reject orders.
          Update your whitelist to{' '}
          <code className="rounded-sm bg-bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-text-primary">
            {data.currentIp}
          </code>
          {data.previousIp && (
            <>
              {' '}(was{' '}
              <code className="rounded-sm bg-bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-text-muted">
                {data.previousIp}
              </code>
              )
            </>
          )}
          .
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded-sm border border-bd-subtle bg-bg-elevated px-2 py-1 text-[10px] text-text-primary transition-colors duration-fast hover:bg-bg-hover"
          >
            <Copy size={10} strokeWidth={1.75} />
            Copy IP
          </button>
          <Link
            href="/settings"
            className="inline-flex items-center rounded-sm border border-bd-subtle bg-bg-elevated px-2 py-1 text-[10px] text-text-primary transition-colors duration-fast hover:bg-bg-hover"
          >
            Open broker settings
          </Link>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-sm p-1 text-text-muted transition-colors duration-fast hover:bg-bg-hover hover:text-text-primary"
      >
        <X size={12} strokeWidth={1.75} />
      </button>
    </div>
  );
}

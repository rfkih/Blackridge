'use client';

import { useState } from 'react';
import { Check, Copy, Globe, Loader2, RefreshCw } from 'lucide-react';
import { useServerIp } from '@/hooks/useServerIp';
import { toast } from '@/hooks/useToast';

interface ServerIpCardProps {
  /** Visual variant — "compact" for dialogs, "card" for settings surfaces. */
  variant?: 'compact' | 'card';
}

/**
 * Shows the backend's current public IP so users know which IP to whitelist
 * on Binance's API-key restrictions. Placed next to anywhere credentials are
 * entered: the Rotate/New account dialogs and the Brokers section in
 * Settings.
 */
export function ServerIpCard({ variant = 'card' }: ServerIpCardProps) {
  const { data: ip, isLoading, isError, refetch, isFetching } = useServerIp();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!ip || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(ip);
      setCopied(true);
      toast.success({ title: 'IP copied to clipboard' });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error({ title: 'Copy failed' });
    }
  };

  const compact = variant === 'compact';

  return (
    <div
      style={{
        padding: compact ? '10px 12px' : '14px 16px',
        borderRadius: 10,
        background: 'var(--mm-surface-2, var(--bg-elevated))',
        border: '1px solid var(--mm-hair, var(--border-subtle))',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Globe
        size={compact ? 13 : 15}
        strokeWidth={1.75}
        style={{ color: 'var(--mm-mint, var(--color-profit))', flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="font-mono"
          style={{
            fontSize: 9,
            letterSpacing: '0.16em',
            color: 'var(--mm-ink-3, var(--text-muted))',
            textTransform: 'uppercase',
          }}
        >
          Whitelist this server IP
        </div>
        <div
          className="font-mono"
          style={{
            marginTop: 2,
            fontSize: compact ? 13 : 15,
            color: 'var(--mm-ink-0, var(--text-primary))',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {isLoading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : isError ? (
            <span style={{ color: 'var(--color-loss)' }}>Unavailable</span>
          ) : (
            (ip ?? '—')
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => void refetch()}
        disabled={isFetching}
        title="Refresh"
        className="mm-btn mm-btn-ghost"
        style={{
          padding: compact ? '4px 7px' : '6px 9px',
          fontSize: 11,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <RefreshCw size={11} className={isFetching ? 'animate-spin' : undefined} />
      </button>
      <button
        type="button"
        onClick={handleCopy}
        disabled={!ip}
        title="Copy"
        className="mm-btn mm-btn-ghost"
        style={{
          padding: compact ? '4px 7px' : '6px 9px',
          fontSize: 11,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
    </div>
  );
}

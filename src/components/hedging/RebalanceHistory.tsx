'use client';

import { useRebalances } from '@/hooks/useRebalances';
import { formatDate, formatPnl } from '@/lib/formatters';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface RebalanceHistoryProps {
  accountId: string | undefined;
}

/**
 * Rebalance log for a HEDGING account: the close-and-reopen events from
 * `useRebalances` rendered as `time · reason · realized Δ`.
 *
 * The per-event from→to BTC weight is not derivable from the available fields
 * (it would need the account equity snapshot at each rebalance, which the app
 * does not expose), so that column is dropped rather than rendered as a
 * permanent "—".
 */
export function RebalanceHistory({ accountId }: RebalanceHistoryProps) {
  const { data: events } = useRebalances(accountId);

  return (
    <div className="br-card" style={{ padding: 24 }}>
      <div className="mb-4">
        <h3
          className="font-display"
          style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}
        >
          Rebalances
        </h3>
        <div className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
          Close-and-reopen weight changes
        </div>
      </div>

      {events.length === 0 ? (
        <div
          style={{
            padding: '36px 16px',
            textAlign: 'center',
            border: '1px dashed var(--border-subtle)',
            borderRadius: 16,
            color: 'var(--text-muted)',
            fontSize: 13,
          }}
        >
          No rebalances yet.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Realized Δ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((ev) => (
              <TableRow key={ev.id}>
                <TableCell className="font-mono text-[12px] text-[var(--text-muted)]">
                  {formatDate(ev.time)}
                </TableCell>
                <TableCell className="capitalize">{ev.reason}</TableCell>
                <TableCell
                  className="text-right font-mono tabular-nums"
                  style={{
                    color: ev.realizedDelta >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
                  }}
                >
                  {formatPnl(ev.realizedDelta)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

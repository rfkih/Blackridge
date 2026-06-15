import { SignalsTable } from '@/components/ml/SignalsTable';

export const metadata = {
  title: 'ML signals | Blackheart',
};

export default function MlSignalsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary">Signals</h1>
        <p className="mt-1 text-sm text-text-muted">
          Every signal_definition row. Filter by status; click into a signal to see its live
          firings, coverage, and recent values.
        </p>
      </header>
      <SignalsTable />
    </div>
  );
}

import { MlMonitorTable } from '@/components/ml/MlMonitorTable';

export const metadata = {
  title: 'ML monitor | Blackheart',
};

export default function MlMonitorPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-100">ML monitor</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Cross-signal health rollup. One row per non-retired signal bound to a live gate. Red rows
          alert at the top.
        </p>
      </header>
      <MlMonitorTable />
    </div>
  );
}

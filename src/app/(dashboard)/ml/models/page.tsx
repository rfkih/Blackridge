import { ModelsTable } from '@/components/ml/ModelsTable';

export const metadata = {
  title: 'ML models | Blackheart',
};

export default function MlModelsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary">Models</h1>
        <p className="mt-1 text-sm text-text-muted">
          Every model_registry row. Click a model for lineage and the signals it backs.
        </p>
      </header>
      <ModelsTable />
    </div>
  );
}

import { redirect } from 'next/navigation';

export default function MlIndex(): never {
  redirect('/ml/monitor');
}

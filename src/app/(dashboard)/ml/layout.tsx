import type { ReactNode } from 'react';

export const metadata = {
  title: 'ML | Blackheart',
};

export default function MlLayout({ children }: { children: ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}

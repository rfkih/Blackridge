
const STATIC_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/portfolio': 'Portfolio',
  '/market': 'Markets',
  '/strategies': 'Strategies',
  '/backtest': 'Backtest',
  '/backtest/new': 'New backtest',
  '/backtest/new/params': 'Backtest params',
  '/backtest/research': 'Backtest research',
  '/research': 'Ops dashboard',
  '/research/sweeps': 'Sweeps',
  '/research/queue': 'Research queue',
  '/research/log': 'Research log',
  '/montecarlo': 'Forward projections',
  '/pnl': 'P&L',
  '/trades': 'Journal',
  '/help': 'Help',
  '/settings': 'Settings',
  '/forgot-password': 'Forgot password',
  '/reset-password': 'Reset password',
  '/verify-email': 'Verify email',
  '/login': 'Sign in',
  '/register': 'Create account',
  '/admin/strategies': 'Strategy catalogue',
  '/admin/historical': 'Historical data',
  '/admin/inbox': 'Inbox',
  '/privacy': 'Privacy',
  '/terms': 'Terms',
  '/cookies': 'Cookies',
};

const PREFIX_TITLES: Array<{ prefix: string; title: string }> = [
  { prefix: '/strategies/', title: 'Strategy detail' },
  { prefix: '/backtest/', title: 'Backtest result' },
  { prefix: '/research/sweeps/', title: 'Sweep detail' },
  { prefix: '/trades/', title: 'Trade detail' },
];

export function resolvePageTitle(pathname: string | null | undefined): string {
  if (!pathname) return 'Dashboard';
  const exact = STATIC_TITLES[pathname];
  if (exact) return exact;

  let bestPrefixMatch: string | null = null;
  let bestPrefixLen = 0;
  for (const { prefix, title } of PREFIX_TITLES) {
    if (pathname.startsWith(prefix) && prefix.length > bestPrefixLen) {
      bestPrefixMatch = title;
      bestPrefixLen = prefix.length;
    }
  }
  return bestPrefixMatch ?? 'Dashboard';
}

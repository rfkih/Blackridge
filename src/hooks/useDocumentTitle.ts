'use client';

import { useEffect } from 'react';

const APP_NAME = 'Meridian Edge';

// No restore-on-unmount: with multiple short-lived instances, one cleanup
// would stomp another's just-set title. Every dashboard route invokes
// this hook, so the title always reflects the current page anyway.
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = title && title.trim() ? `${title} \u2014 ${APP_NAME}` : APP_NAME;
  }, [title]);
}

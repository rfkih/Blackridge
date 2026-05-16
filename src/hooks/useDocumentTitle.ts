'use client';

import { useEffect } from 'react';

const APP_NAME = 'Blackridge';

export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = title && title.trim() ? `${title} \u2014 ${APP_NAME}` : APP_NAME;
  }, [title]);
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Thin top-of-viewport progress bar — the Vercel / GitHub pattern.
 *
 * Next.js App Router doesn't expose a `router.events` API anymore; instead
 * we use the subtlest signal available: click interception on `<Link>`
 * descendants of <body>, paired with pathname+searchParams transitions.
 *
 * Why not just watch for pathname changes alone?
 *  - The pathname only flips AFTER server data is ready. That's too late to
 *    show "loading started".
 *  - Intercepting the click on an anchor gives us the "about to navigate"
 *    moment without touching every <Link> call-site.
 */
export function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);

  const timerRef = useRef<number | null>(null);
  const hideRef = useRef<number | null>(null);

  // Drive the bar forward in small increments while active — stalls near the
  // top so a fast navigation reaches 100% quickly but a slow one still looks
  // alive instead of hanging at one value.
  useEffect(() => {
    if (!active) return;
    setProgress(12);
    const tick = () => {
      setProgress((p) => {
        if (p >= 90) return p; // park at 90 until we know we're done
        const step = p < 40 ? 6 : p < 70 ? 3 : 1.2;
        return p + step;
      });
      timerRef.current = window.setTimeout(tick, 140);
    };
    timerRef.current = window.setTimeout(tick, 140);
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, [active]);

  // When the route actually changes (pathname+search), the navigation finished.
  // Drive to 100%, then fade out.
  useEffect(() => {
    if (!active) return;
    setProgress(100);
    if (hideRef.current != null) window.clearTimeout(hideRef.current);
    hideRef.current = window.setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 240);
    return () => {
      if (hideRef.current != null) window.clearTimeout(hideRef.current);
    };
    // Intentionally keyed on the transition signal — we only want to
    // react when the pathname or query actually changed.
  }, [pathname, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect the start of a navigation by intercepting anchor clicks at the
  // document level. Only same-origin, no-modifier clicks count — matches
  // Next.js Link's own criteria for client-side navigation.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = (e.target as HTMLElement | null)?.closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      if (!href) return;
      if (target.target && target.target !== '_self') return;
      if (href.startsWith('http') || href.startsWith('//')) {
        try {
          const u = new URL(href, window.location.href);
          if (u.origin !== window.location.origin) return;
        } catch {
          return;
        }
      }
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      // Same URL — don't start the bar.
      const currentHref = window.location.pathname + window.location.search;
      if (href === currentHref) return;

      setActive(true);
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  if (!active && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          background:
            'linear-gradient(90deg, var(--color-profit) 0%, rgba(52,232,181,0.85) 70%, rgba(52,232,181,0.0) 100%)',
          boxShadow: '0 0 10px rgba(52, 232, 181, 0.55), 0 0 2px rgba(52, 232, 181, 0.9)',
          transition:
            'width 180ms cubic-bezier(0.25, 1, 0.5, 1), opacity 220ms ease-out',
          opacity: active || progress < 100 ? 1 : 0,
        }}
      />
    </div>
  );
}

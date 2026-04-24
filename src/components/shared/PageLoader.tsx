import { LogoMark } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';

interface PageLoaderProps {
  /** Label under the animation. Defaults to "Loading". */
  label?: string;
  /** When true, occupies the full viewport with a backdrop — use for route transitions. */
  fullscreen?: boolean;
  className?: string;
}

/**
 * Brand-consistent loading state — dark terminal surface, mint accent, tight
 * type, and a gentle rotating arc that resolves into the LogoMark.
 *
 * Use as the default export of a Next.js `loading.tsx` file for automatic
 * route-transition UI, or drop inline anywhere with `fullscreen={false}`.
 */
export function PageLoader({ label = 'Loading', fullscreen = true, className }: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        fullscreen
          ? 'fixed inset-0 z-50 flex items-center justify-center'
          : 'flex w-full items-center justify-center py-24',
        className,
      )}
      style={
        fullscreen
          ? {
              backgroundColor: 'var(--bg-base)',
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(232, 235, 240, 0.04) 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }
          : undefined
      }
    >
      <div className="flex flex-col items-center gap-6">
        {/* Rotating ring + logo stack */}
        <div className="relative h-[88px] w-[88px]">
          {/* Outer orbit — slow rotating dashed ring */}
          <svg
            className="absolute inset-0 animate-[mm-spin-slow_3.2s_linear_infinite]"
            viewBox="0 0 100 100"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="mm-loader-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--color-profit)" stopOpacity="1" />
                <stop offset="0.55" stopColor="var(--color-profit)" stopOpacity="0.25" />
                <stop offset="1" stopColor="var(--color-profit)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth="1"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="url(#mm-loader-ring)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="110 200"
            />
          </svg>

          {/* Inner orbit — faster, opposite direction, shorter arc */}
          <svg
            className="absolute inset-2 animate-[mm-spin-reverse_1.9s_cubic-bezier(0.65,0,0.35,1)_infinite]"
            viewBox="0 0 100 100"
            aria-hidden="true"
          >
            <circle
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke="var(--color-profit)"
              strokeOpacity="0.9"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="30 210"
            />
          </svg>

          {/* Pulsing logo at centre */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              filter: 'drop-shadow(0 0 10px rgba(31, 200, 150, 0.35))',
            }}
          >
            <span className="animate-[mm-pulse_2s_ease-in-out_infinite] text-[var(--color-profit)]">
              <LogoMark size={28} tone="plain" />
            </span>
          </div>
        </div>

        {/* Label + animated dots */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="font-mono text-[10px] uppercase"
            style={{
              letterSpacing: '0.32em',
              color: 'var(--text-secondary)',
            }}
          >
            <span>{label}</span>
            <span className="ml-1 inline-flex items-baseline gap-[3px] align-baseline">
              <span
                className="inline-block h-[3px] w-[3px] rounded-full bg-[var(--color-profit)] animate-[mm-dot_1.2s_ease-in-out_infinite]"
                style={{ animationDelay: '0ms' }}
              />
              <span
                className="inline-block h-[3px] w-[3px] rounded-full bg-[var(--color-profit)] animate-[mm-dot_1.2s_ease-in-out_infinite]"
                style={{ animationDelay: '200ms' }}
              />
              <span
                className="inline-block h-[3px] w-[3px] rounded-full bg-[var(--color-profit)] animate-[mm-dot_1.2s_ease-in-out_infinite]"
                style={{ animationDelay: '400ms' }}
              />
            </span>
          </div>

          {/* Hairline bar — scans left/right to echo the ring's motion */}
          <div
            className="relative h-[2px] w-[160px] overflow-hidden rounded-full"
            style={{ backgroundColor: 'var(--border-subtle)' }}
          >
            <span
              className="absolute inset-y-0 w-1/3 animate-[mm-scan_1.8s_cubic-bezier(0.65,0,0.35,1)_infinite] rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent, var(--color-profit), transparent)',
                boxShadow: '0 0 8px rgba(31, 200, 150, 0.45)',
              }}
            />
          </div>
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

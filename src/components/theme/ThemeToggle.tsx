'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={!isDark}
      className={cn(
        'group relative inline-flex h-8 w-8 items-center justify-center rounded-sm',
        'text-text-secondary transition-colors duration-fast ease-out-quart',
        'hover:bg-bg-hover hover:text-text-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <Sun
        size={15}
        strokeWidth={1.75}
        className={cn(
          'absolute transition-all duration-base ease-out-expo',
          isDark ? 'rotate-45 scale-75 opacity-0' : 'rotate-0 scale-100 opacity-100',
        )}
      />
      <Moon
        size={15}
        strokeWidth={1.75}
        className={cn(
          'absolute transition-all duration-base ease-out-expo',
          isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-45 scale-75 opacity-0',
        )}
      />
    </button>
  );
}

import type { Config } from 'tailwindcss';

const config: Config = {
  // Theme is controlled by the `data-theme` attribute on <html>, not a class.
  // shadcn-originating `dark:` utilities are unused by the redesigned components,
  // but we keep the selector present for any third-party code.
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── shadcn/ui (HSL-wrapped CSS vars; re-derived per theme in globals.css) ──
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },

        // ── Blackheart named tokens (raw CSS vars, theme-aware) ──
        bg: {
          base: 'var(--bg-base)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
          overlay: 'var(--bg-overlay)',
          hover: 'var(--bg-hover)',
        },
        bd: {
          subtle: 'var(--border-subtle)',
          DEFAULT: 'var(--border-default)',
          strong: 'var(--border-strong)',
        },
        profit: 'var(--color-profit)',
        loss: 'var(--color-loss)',
        warning: 'var(--color-warning)',
        info: 'var(--color-info)',
        neutral: 'var(--color-neutral)',
        tint: {
          profit: 'var(--tint-profit)',
          loss: 'var(--tint-loss)',
          warning: 'var(--tint-warning)',
          info: 'var(--tint-info)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          inverse: 'var(--text-inverse)',
        },
        brand: {
          DEFAULT: 'var(--accent-primary)',
          subtle: 'var(--accent-subtle)',
          glow: 'var(--accent-glow)',
        },
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
        sans: ['var(--font-body)'],
      },
      fontSize: {
        // Dramatic scale — "big things BIG, small things SMALL, no mushy middle"
        caption: ['10px', { lineHeight: '1.4', letterSpacing: '0.12em' }],
        micro: ['11px', { lineHeight: '1.45' }],
        body: ['13px', { lineHeight: '1.55' }],
        'body-lg': ['14px', { lineHeight: '1.55' }],
        heading: ['15px', { lineHeight: '1.35', letterSpacing: '-0.005em' }],
        'heading-lg': ['18px', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        'display-sm': ['24px', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'display-md': ['36px', { lineHeight: '1.05', letterSpacing: '-0.025em' }],
        'display-lg': ['44px', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
        'display-xl': ['56px', { lineHeight: '1', letterSpacing: '-0.035em' }],
        'display-2xl': ['72px', { lineHeight: '0.98', letterSpacing: '-0.04em' }],
      },
      letterSpacing: {
        tightest: '-0.035em',
        tighter: '-0.025em',
        tight: '-0.01em',
        normal: '0',
        wide: '0.04em',
        wider: '0.08em',
        widest: '0.12em',
      },
      borderRadius: {
        none: '0',
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        // Intentionally no xl / 2xl / full — terminal aesthetic rejects pill UI.
      },
      borderWidth: {
        hairline: '1px',
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
        float: 'var(--shadow-float)',
        'glow-profit': 'var(--shadow-glow-profit)',
        'glow-loss': 'var(--shadow-glow-loss)',
      },
      transitionTimingFunction: {
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        fast: '120ms',
        base: '180ms',
        slow: '280ms',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 180ms cubic-bezier(0.25, 1, 0.5, 1) both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;

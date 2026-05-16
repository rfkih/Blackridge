// Semantic colour tones used across status pills, dots, and verdict badges.
// Maps to the dark-mode CSS variables defined in globals.css; the same tone
// stays visually coherent whether it's rendering a queue state, a sweep
// verdict, or a kill-switch flag.

export type Tone = 'profit' | 'loss' | 'warning' | 'info' | 'muted';

export function toneColor(tone: Tone): string {
  switch (tone) {
    case 'profit':
      return 'var(--color-profit)';
    case 'loss':
      return 'var(--color-loss)';
    case 'warning':
      return 'var(--color-warning)';
    case 'info':
      return 'var(--color-info)';
    default:
      return 'var(--text-muted)';
  }
}

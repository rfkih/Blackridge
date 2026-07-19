import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BookCard } from '../BookCard';
import type { PortfolioBook, SleeveTarget } from '@/types/equity';

const paperBook: PortfolioBook = {
  bookCode: 'EQ7_AGGRESSIVE',
  version: 1,
  status: 'PAPER',
  frozenAt: '2026-07-17T00:00:00',
  createdTime: '2026-07-10T00:00:00',
};

const candidateBook: PortfolioBook = {
  bookCode: 'EQ6_SURVSAFE',
  version: 2,
  status: 'CANDIDATE',
  frozenAt: null,
  createdTime: '2026-07-12T00:00:00',
};

const sampleTargets: SleeveTarget[] = [
  {
    targetId: 't1',
    bookCode: 'EQ7_AGGRESSIVE',
    bookVersion: 1,
    sleeveCode: 'EQ_US_TREND',
    symbol: 'NVDA',
    exchange: 'NASDAQ',
    currency: 'USD',
    side: 'LONG',
    targetWeight: 0.15,
    targetNotional: 1500,
    asOfDate: '2026-07-17',
  },
];

describe('BookCard', () => {
  it('renders the book code', () => {
    render(<BookCard book={paperBook} targets={[]} selected={false} onSelect={() => {}} />);
    expect(screen.getByText('EQ7_AGGRESSIVE')).toBeInTheDocument();
  });

  it('renders the PAPER status pill', () => {
    render(<BookCard book={paperBook} targets={[]} selected={false} onSelect={() => {}} />);
    expect(screen.getByText('PAPER')).toBeInTheDocument();
  });

  it('renders the CANDIDATE status pill', () => {
    render(<BookCard book={candidateBook} targets={[]} selected={false} onSelect={() => {}} />);
    expect(screen.getByText('CANDIDATE')).toBeInTheDocument();
  });

  it('shows frozen date when frozenAt is set', () => {
    render(<BookCard book={paperBook} targets={[]} selected={false} onSelect={() => {}} />);
    // Should display version and some frozen date text (locale-formatted)
    expect(screen.getByText(/v1/)).toBeInTheDocument();
    // frozen date is locale-formatted; we just check it's NOT the dash
    const frozenText = screen.getByText(/frozen/i);
    expect(frozenText).toBeInTheDocument();
    expect(frozenText.textContent).not.toContain('frozen —');
  });

  it('shows dash for frozenAt when null', () => {
    render(<BookCard book={candidateBook} targets={[]} selected={false} onSelect={() => {}} />);
    expect(screen.getByText(/frozen —/)).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(<BookCard book={paperBook} targets={[]} selected={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('displays sleeve count from targets', () => {
    render(
      <BookCard book={paperBook} targets={sampleTargets} selected={false} onSelect={() => {}} />,
    );
    // StatCard shows value "1" for 1 sleeve
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('applies selected styling class when selected=true', () => {
    const { rerender } = render(
      <BookCard book={paperBook} targets={[]} selected={false} onSelect={() => {}} />,
    );
    let btn = screen.getByRole('button');
    expect(btn.className).not.toContain('bg-[var(--bg-elevated)]');

    rerender(<BookCard book={paperBook} targets={[]} selected onSelect={() => {}} />);
    btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-[var(--bg-elevated)]');
  });
});

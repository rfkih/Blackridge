import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('smoke', () => {
  it('renders a heading', () => {
    render(<h1>Blackheart</h1>);
    expect(screen.getByRole('heading', { name: 'Blackheart' })).toBeInTheDocument();
  });
});

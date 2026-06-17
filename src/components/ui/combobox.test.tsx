import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Combobox } from './combobox';

const OPTIONS = ['BTCUSDT', 'ETHUSDT', 'DOGEUSDT', 'XRPUSDT'];

function setup(value = 'BTCUSDT') {
  const onChange = vi.fn();
  render(
    <Combobox
      value={value}
      onChange={onChange}
      options={OPTIONS}
      ariaLabel="Symbol"
      searchPlaceholder="Search symbols"
    />,
  );
  return { onChange };
}

function open() {
  fireEvent.click(screen.getByRole('combobox'));
}

describe('Combobox', () => {
  it('shows the selected value on the trigger', () => {
    setup('ETHUSDT');
    expect(screen.getByRole('combobox')).toHaveTextContent('ETHUSDT');
  });

  it('opens on click and lists every option', () => {
    setup();
    open();
    const list = screen.getByRole('listbox');
    expect(within(list).getAllByRole('option')).toHaveLength(OPTIONS.length);
  });

  it('filters the list as you type (case-insensitive substring)', () => {
    setup();
    open();
    fireEvent.change(screen.getByPlaceholderText('Search symbols'), {
      target: { value: 'do' },
    });
    const opts = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(opts).toHaveLength(1);
    expect(opts[0]).toHaveTextContent('DOGEUSDT');
  });

  it('fires onChange with the chosen value and closes', () => {
    const { onChange } = setup();
    open();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'XRPUSDT' }));
    expect(onChange).toHaveBeenCalledWith('XRPUSDT');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows the empty message when nothing matches', () => {
    setup();
    open();
    fireEvent.change(screen.getByPlaceholderText('Search symbols'), {
      target: { value: 'zzz' },
    });
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('keyboard: ArrowDown then Enter selects the highlighted option', () => {
    const { onChange } = setup();
    open();
    const input = screen.getByPlaceholderText('Search symbols');
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // 0 (BTC) -> 1 (ETH)
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('ETHUSDT');
  });

  it('closes on Escape without selecting', () => {
    const { onChange } = setup();
    open();
    fireEvent.keyDown(screen.getByPlaceholderText('Search symbols'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});

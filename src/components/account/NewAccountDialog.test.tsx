import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- mock the create-account hook so we can assert the mutation payload ---
const mutate = vi.fn();
let isPending = false;
vi.mock('@/hooks/useAccounts', () => ({
  useCreateAccount: () => ({ mutate, isPending }),
}));

// --- mock toast (no-op) ---
vi.mock('@/hooks/useToast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

// --- ServerIpCard pulls a query hook we don't care about here ---
vi.mock('./ServerIpCard', () => ({
  ServerIpCard: () => null,
}));

// --- mock the exchange Select to a native <select> (jsdom-friendly); the
//     account-type segmented control stays REAL so we test the real wiring. ---
vi.mock('@/components/ui/select', () => {
  const R = require('react');
  return {
    Select: ({ value, onValueChange, disabled, children }: any) =>
      R.createElement(
        'select',
        {
          'aria-label': 'Exchange',
          value,
          disabled,
          onChange: (e: any) => onValueChange(e.target.value),
        },
        children,
      ),
    SelectTrigger: () => null,
    SelectContent: ({ children }: any) => R.createElement(R.Fragment, null, children),
    SelectItem: ({ value, children }: any) => R.createElement('option', { value }, children),
    SelectValue: () => null,
  };
});

import { NewAccountDialog } from './NewAccountDialog';

describe('NewAccountDialog — account type wiring', () => {
  beforeEach(() => {
    mutate.mockReset();
    isPending = false;
  });

  it('defaults to TRADING and submits accountType:TRADING when the selector is untouched', async () => {
    const user = userEvent.setup();
    render(<NewAccountDialog open onOpenChange={() => {}} />);

    await user.type(screen.getByPlaceholderText('Main'), 'Main');
    // api key + secret inputs by id
    await user.type(document.querySelector('#account-api-key') as HTMLElement, 'api-key-123456');
    await user.type(
      document.querySelector('#account-api-secret') as HTMLElement,
      'api-secret-123456',
    );
    await user.click(
      screen.getByLabelText('I have disabled withdrawal permissions on this API key'),
    );

    // selector defaults to TRADING — do not touch it
    expect(screen.getByRole('button', { name: /Trading/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: /Connect account/ }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const payload = mutate.mock.calls[0][0];
    expect(payload).toMatchObject({
      username: 'Main',
      exchange: 'BNC',
      apiKey: 'api-key-123456',
      apiSecret: 'api-secret-123456',
      acknowledgedSafety: true,
      accountType: 'TRADING',
    });
  });

  it('submits accountType:HEDGING after selecting Hedging', async () => {
    const user = userEvent.setup();
    render(<NewAccountDialog open onOpenChange={() => {}} />);

    await user.type(screen.getByPlaceholderText('Main'), 'Hedge book');
    await user.type(document.querySelector('#account-api-key') as HTMLElement, 'api-key-123456');
    await user.type(
      document.querySelector('#account-api-secret') as HTMLElement,
      'api-secret-123456',
    );
    await user.click(
      screen.getByLabelText('I have disabled withdrawal permissions on this API key'),
    );

    await user.click(screen.getByRole('button', { name: /Hedging/ }));
    await user.click(screen.getByRole('button', { name: /Connect account/ }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toMatchObject({ accountType: 'HEDGING' });
  });

  it('shows the permanence helper line near the selector', () => {
    render(<NewAccountDialog open onOpenChange={() => {}} />);
    expect(screen.getByText(/permanent/i)).toBeInTheDocument();
  });

  it('keeps existing fields intact — submit is blocked until safety is acknowledged', async () => {
    const user = userEvent.setup();
    render(<NewAccountDialog open onOpenChange={() => {}} />);

    await user.type(screen.getByPlaceholderText('Main'), 'Main');
    await user.type(document.querySelector('#account-api-key') as HTMLElement, 'api-key-123456');
    await user.type(
      document.querySelector('#account-api-secret') as HTMLElement,
      'api-secret-123456',
    );

    // safety NOT acknowledged → button disabled, mutate never called
    await user.click(screen.getByRole('button', { name: /Connect account/ }));
    expect(mutate).not.toHaveBeenCalled();
  });
});

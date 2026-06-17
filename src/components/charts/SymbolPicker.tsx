'use client';

import { Combobox } from '@/components/ui/combobox';
import { SUPPORTED_SYMBOLS } from '@/lib/symbols';

interface SymbolPickerProps {
  value: string;
  onChange: (symbol: string) => void;
}

/**
 * Compact, searchable symbol picker used on the Market page and the
 * trade-history chart. Thin wrapper over {@link Combobox} so the symbol roster
 * (now 13 and growing) stays type-to-filterable everywhere it appears.
 */
export function SymbolPicker({ value, onChange }: SymbolPickerProps) {
  return (
    <Combobox
      value={value}
      onChange={(s) => onChange(s.toUpperCase())}
      options={SUPPORTED_SYMBOLS as readonly string[]}
      ariaLabel={`Current symbol: ${value}. Click to change.`}
      searchPlaceholder="Search symbol…"
      triggerClassName="font-display text-sm font-semibold"
      contentClassName="w-48"
    />
  );
}

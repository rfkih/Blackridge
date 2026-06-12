'use client';

import * as React from 'react';
import { PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type DropdownContentProps = React.ComponentPropsWithoutRef<typeof PopoverContent>;

export const DropdownContent = React.forwardRef<
  React.ElementRef<typeof PopoverContent>,
  DropdownContentProps
>(({ className, ...props }, ref) => (
  <PopoverContent
    ref={ref}
    className={cn(
      'border-[var(--border-default)] bg-[var(--bg-overlay)] p-1.5 text-[var(--text-primary)] shadow-[var(--shadow-float)]',
      className,
    )}
    {...props}
  />
));
DropdownContent.displayName = 'DropdownContent';

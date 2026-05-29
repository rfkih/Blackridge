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
      'bg-[var(--bg-overlay)] border-[var(--border-default)] shadow-[var(--shadow-float)] text-[var(--text-primary)] p-1.5',
      className,
    )}
    {...props}
  />
));
DropdownContent.displayName = 'DropdownContent';

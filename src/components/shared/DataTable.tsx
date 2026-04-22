'use client';

import { useMemo, useRef } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Columns3,
  Search,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const VIRTUAL_THRESHOLD = 100;
const ROW_HEIGHT = 44;
const DEFAULT_PAGE_SIZES = [20, 50, 100];

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  isLoading?: boolean;
  onRowClick?: (row: TData) => void;
  /** Stable row id → highlight this row (e.g. selected trade detail). */
  selectedRowId?: string;
  /** Accessor for row id (defaults to `row.id` if present). */
  getRowId?: (row: TData) => string;
  /** Hide the global search input. */
  hideSearch?: boolean;
  /** Hide the column-visibility menu. */
  hideColumnMenu?: boolean;
  /** Start with a specific sort — e.g. [{ id: 'openedAt', desc: true }]. */
  initialSort?: SortingState;
  /** Placeholder for the search input. */
  searchPlaceholder?: string;
  /** Empty-state title + description when data.length === 0 and !isLoading. */
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ElementType;
  /** Hide pagination footer (for fully virtualized lists). */
  hidePagination?: boolean;
  /** Optional extra content rendered in the filter bar (right side). */
  toolbar?: React.ReactNode;
  /** Initial/controlled page size. */
  pageSize?: number;
}

export function DataTable<TData>({
  columns,
  data,
  isLoading,
  onRowClick,
  selectedRowId,
  getRowId,
  hideSearch,
  hideColumnMenu,
  initialSort,
  searchPlaceholder = 'Search…',
  emptyTitle = 'No results',
  emptyDescription = 'Adjust filters and try again.',
  emptyIcon,
  hidePagination,
  toolbar,
  pageSize = 20,
}: DataTableProps<TData>) {
  const tableRef = useRef<HTMLDivElement>(null);

  const tableInstance = useReactTable({
    data,
    columns,
    getRowId: getRowId
      ? (row) => getRowId(row)
      : (row) => {
          const maybeId = (row as { id?: unknown }).id;
          return typeof maybeId === 'string' ? maybeId : String(maybeId ?? '');
        },
    initialState: {
      pagination: { pageIndex: 0, pageSize },
      sorting: initialSort ?? [],
      columnVisibility: {} as VisibilityState,
      rowSelection: {} as RowSelectionState,
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const rows = tableInstance.getRowModel().rows;
  const shouldVirtualize = rows.length > VIRTUAL_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => ROW_HEIGHT,
    getScrollElement: () => tableRef.current,
    overscan: 12,
    enabled: shouldVirtualize,
  });
  const virtualRows = shouldVirtualize ? virtualizer.getVirtualItems() : [];
  const totalVirtualSize = shouldVirtualize ? virtualizer.getTotalSize() : 0;
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalVirtualSize - virtualRows[virtualRows.length - 1].end : 0;

  const leafColumns = tableInstance.getAllLeafColumns();
  const visibleColumnCount = useMemo(
    () => leafColumns.filter((c) => c.getIsVisible()).length,
    [leafColumns],
  );

  const globalFilter = (tableInstance.getState().globalFilter as string) ?? '';

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar — search + column menu + caller-provided extras */}
      {(!hideSearch || !hideColumnMenu || toolbar) && (
        <div className="flex flex-wrap items-center gap-2">
          {!hideSearch && (
            <div className="relative min-w-[220px] flex-1">
              <Search
                size={13}
                strokeWidth={1.75}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                type="text"
                value={globalFilter}
                onChange={(e) => tableInstance.setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className={cn(
                  'h-9 w-full rounded-md border border-bd-subtle bg-bg-surface pl-8 pr-3',
                  'text-[13px] text-text-primary placeholder:text-[var(--text-muted)]',
                  'transition-colors focus:border-[var(--accent-primary)] focus:outline-none',
                )}
                aria-label="Search"
              />
            </div>
          )}

          {toolbar}

          {!hideColumnMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-md border border-bd-subtle bg-bg-surface px-3',
                    'text-[12px] text-text-secondary transition-colors hover:border-bd hover:bg-bg-elevated hover:text-text-primary',
                  )}
                  aria-label="Toggle columns"
                >
                  <Columns3 size={13} strokeWidth={1.75} />
                  Columns
                  <ChevronDown size={12} strokeWidth={1.75} className="opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-text-muted">
                  Visible columns
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {leafColumns
                  .filter((c) => c.getCanHide())
                  .map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      className="text-[12px] capitalize"
                      checked={col.getIsVisible()}
                      onCheckedChange={(v) => col.toggleVisibility(Boolean(v))}
                    >
                      {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* Table body */}
      <div
        ref={tableRef}
        className={cn(
          'relative overflow-auto rounded-md border border-bd-subtle bg-bg-surface',
          shouldVirtualize && 'max-h-[640px]',
        )}
      >
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 bg-bg-surface">
            {tableInstance.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-bd-subtle">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        'label-caps whitespace-nowrap px-3 py-2.5 align-middle',
                        canSort &&
                          'cursor-pointer select-none transition-colors hover:text-text-secondary',
                      )}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      style={{ width: header.getSize() === 150 ? undefined : header.getSize() }}
                    >
                      {header.isPlaceholder ? null : (
                        <span className="inline-flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            <SortIndicator
                              direction={
                                sorted === 'asc' ? 'asc' : sorted === 'desc' ? 'desc' : null
                              }
                            />
                          )}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-bd-subtle last:border-b-0">
                  {Array.from({ length: Math.max(visibleColumnCount, 1) }).map((_, j) => (
                    <td key={j} className="px-3 py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(visibleColumnCount, 1)} className="px-3 py-12">
                  <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : shouldVirtualize ? (
              <>
                {paddingTop > 0 && (
                  <tr aria-hidden="true">
                    {/* eslint-disable-next-line jsx-a11y/control-has-associated-label -- spacer td for virtualizer padding */}
                    <td colSpan={visibleColumnCount} style={{ height: paddingTop }} />
                  </tr>
                )}
                {virtualRows.map((vr) => {
                  const row = rows[vr.index];
                  const rowId = row.id;
                  const isSelected = selectedRowId != null && rowId === selectedRowId;
                  return (
                    <BodyRow
                      key={row.id}
                      row={row}
                      isSelected={isSelected}
                      onRowClick={onRowClick}
                    />
                  );
                })}
                {paddingBottom > 0 && (
                  <tr aria-hidden="true">
                    {/* eslint-disable-next-line jsx-a11y/control-has-associated-label -- spacer td for virtualizer padding */}
                    <td colSpan={visibleColumnCount} style={{ height: paddingBottom }} />
                  </tr>
                )}
              </>
            ) : (
              rows.map((row) => {
                const rowId = row.id;
                const isSelected = selectedRowId != null && rowId === selectedRowId;
                return (
                  <BodyRow key={row.id} row={row} isSelected={isSelected} onRowClick={onRowClick} />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!hidePagination && !isLoading && rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="text-[11px] text-text-muted">
            {tableInstance.getFilteredRowModel().rows.length} row
            {tableInstance.getFilteredRowModel().rows.length === 1 ? '' : 's'} · page{' '}
            {tableInstance.getState().pagination.pageIndex + 1} of{' '}
            {Math.max(1, tableInstance.getPageCount())}
          </div>

          <div className="flex items-center gap-3">
            <select
              value={tableInstance.getState().pagination.pageSize}
              onChange={(e) => tableInstance.setPageSize(Number(e.target.value))}
              className="h-8 rounded-md border border-bd-subtle bg-bg-surface px-2 text-[11px] text-text-secondary focus:outline-none"
              aria-label="Rows per page"
            >
              {DEFAULT_PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => tableInstance.previousPage()}
                disabled={!tableInstance.getCanPreviousPage()}
                className="flex size-8 items-center justify-center rounded-md border border-bd-subtle bg-bg-surface text-text-secondary transition-colors hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft size={13} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => tableInstance.nextPage()}
                disabled={!tableInstance.getCanNextPage()}
                className="flex size-8 items-center justify-center rounded-md border border-bd-subtle bg-bg-surface text-text-secondary transition-colors hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight size={13} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface BodyRowProps<TData> {
  row: ReturnType<ReturnType<typeof useReactTable<TData>>['getRowModel']>['rows'][number];
  isSelected: boolean;
  onRowClick?: (row: TData) => void;
}

function BodyRow<TData>({ row, isSelected, onRowClick }: BodyRowProps<TData>) {
  const handleClick = onRowClick ? () => onRowClick(row.original) : undefined;
  return (
    <tr
      onClick={handleClick}
      className={cn(
        'border-b border-bd-subtle transition-colors last:border-b-0',
        onRowClick && 'cursor-pointer hover:bg-bg-elevated',
        isSelected && 'bg-bg-hover',
      )}
      style={isSelected ? { boxShadow: 'inset 2px 0 0 0 var(--accent-primary)' } : undefined}
    >
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} className="whitespace-nowrap px-3 py-2.5 align-middle text-[13px]">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}

function SortIndicator({ direction }: { direction: 'asc' | 'desc' | null }) {
  if (direction === 'asc') return <ChevronUp size={11} strokeWidth={2} className="text-profit" />;
  if (direction === 'desc')
    return <ChevronDown size={11} strokeWidth={2} className="text-profit" />;
  return <ArrowUpDown size={10} strokeWidth={1.75} className="opacity-40" />;
}

// Shared helpers for the strategy params forms (LSR, VCB, VBO). Each form
// merges backend-returned overrides on top of canonical defaults, compares
// values to compute "changed" badges, and emits a sparse PATCH on save.

/**
 * Merge backend-returned params on top of the canonical defaults.
 *
 * The backend's `effectiveParams` envelope can carry explicit `null` for
 * columns the user has never customised (a freshly-provisioned param row
 * is all nulls until the first PATCH). A naive `{...defaults, ...initial}`
 * would let those nulls clobber the defaults — we filter them out so "no
 * value in the table" falls through to the constant default.
 */
export function mergeParams<T extends object>(defaults: T, initial: Partial<T>): T {
  const filtered: Partial<T> = {};
  (Object.keys(initial) as Array<keyof T>).forEach((key) => {
    const v = initial[key];
    if (v !== null && v !== undefined) {
      filtered[key] = v;
    }
  });
  return { ...defaults, ...filtered };
}

/** Numeric equality with a small epsilon — strict equality otherwise. */
export function paramValuesEqual(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < 1e-9;
  }
  return a === b;
}

/** Sparse diff — only the fields that differ from defaults. */
export function computeParamsDiff<T extends object>(defaults: T, current: T): Partial<T> {
  const diff: Partial<T> = {};
  (Object.keys(defaults) as Array<keyof T>).forEach((key) => {
    if (!paramValuesEqual(defaults[key], current[key])) {
      diff[key] = current[key];
    }
  });
  return diff;
}

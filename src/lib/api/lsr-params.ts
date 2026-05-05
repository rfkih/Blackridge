import type { LsrParams } from '@/types/strategy';
import { createParamsCrud } from './paramsCrud';

const lsr = createParamsCrud<LsrParams>('lsr-params');

/** /defaults returns the same envelope as /:id — params live under effectiveParams. */
export const getLsrDefaults = lsr.getDefaults;
/** Individual strategy endpoint wraps params in effectiveParams. */
export const getLsrParams = lsr.get;
export const putLsrParams = lsr.put;
export const patchLsrParams = lsr.patch;
export const deleteLsrParams = lsr.remove;

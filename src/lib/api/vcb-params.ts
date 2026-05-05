import type { VcbParams } from '@/types/strategy';
import { createParamsCrud } from './paramsCrud';

const vcb = createParamsCrud<VcbParams>('vcb-params');

/** /defaults returns the same envelope as /:id — params live under effectiveParams. */
export const getVcbDefaults = vcb.getDefaults;
export const getVcbParams = vcb.get;
export const putVcbParams = vcb.put;
export const patchVcbParams = vcb.patch;
export const deleteVcbParams = vcb.remove;

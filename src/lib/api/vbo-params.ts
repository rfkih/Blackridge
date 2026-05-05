import type { VboParams } from '@/types/strategy';
import { createParamsCrud } from './paramsCrud';

const vbo = createParamsCrud<VboParams>('vbo-params');

/** /defaults returns the same envelope as /:id — params live under effectiveParams. */
export const getVboDefaults = vbo.getDefaults;
export const putVboParams = vbo.put;
export const patchVboParams = vbo.patch;
export const deleteVboParams = vbo.remove;

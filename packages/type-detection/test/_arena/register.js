// @ts-check

/**
 * Registrar loaded via `node --import` before the arena's target subpath
 * evaluates, so the `@/` → `src/` resolve hook is active for the whole
 * module graph. Kept separate from the hook itself because `register`
 * loads the hook in its own module thread.
 */

import { register } from 'node:module';

register('./resolve.js', import.meta.url);

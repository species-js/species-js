// @ts-check

/**
 * Node module-resolution hook that maps the package's `@/` alias to `src/`,
 * mirroring the `@` → `src` alias in `vite.config.js`. It exists so the
 * entry-point arena (`test/entry-arena.test.js`) can load a source subpath as
 * its own entry point in a fresh Node process — the one thing the barrel and
 * the bundler both hide (ADR #070). The hook stands in for an outside
 * consumer's resolver: the permanent delivery-seam fixture.
 */

import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
const isFile = (/** @type {string} */ path) =>
  existsSync(path) && statSync(path).isFile();

/** @type {import('node:module').ResolveHook} */
export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const sub = specifier.slice(2);
    for (const candidate of [SRC + sub, SRC + sub + '.js', SRC + sub + '/index.js']) {
      if (isFile(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}

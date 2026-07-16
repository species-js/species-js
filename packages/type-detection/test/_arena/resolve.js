// @ts-check

/**
 * Node module-resolution hook that maps the package's `@/` alias to `src/`,
 * mirroring the `@` → `src` alias in `vite.config.js`. It exists so the
 * entry-point arena (`test/entry-arena.test.js`) can load a source subpath as
 * its own entry point in a fresh Node process — the one thing the barrel and
 * the bundler both hide (ADR #070). The hook stands in for an outside
 * consumer's resolver: the permanent delivery-seam fixture.
 *
 * Everything stays in `file://` URL space (only converting to an OS path for
 * the existence check), so mapping is identical on POSIX and Windows — a raw
 * `C:\…` path concatenated with `/`-joined subpaths would break the Windows
 * resolver.
 */

import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = new URL('../../src/', import.meta.url);

const isFile = (/** @type {URL} */ url) => {
  const path = fileURLToPath(url);
  return existsSync(path) && statSync(path).isFile();
};

/** @type {import('node:module').ResolveHook} */
export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const sub = specifier.slice(2);
    for (const relative of [sub, `${sub}.js`, `${sub}/index.js`]) {
      const candidate = new URL(relative, SRC);
      if (isFile(candidate)) {
        return nextResolve(candidate.href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}

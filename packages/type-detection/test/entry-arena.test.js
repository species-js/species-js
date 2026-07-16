// @ts-check

/**
 * @module test/entry-arena
 *
 * Axis 5 — the delivery seam. Every axis-1 through axis-4 suite enters through
 * the `#index` barrel, whose re-export order is hand-tuned and load-bearing, so
 * no test ever loaded a published subpath as its OWN entry point. That blind
 * spot hid a load-order temporal-dead-zone crash: entering the `utility` subpath
 * directly threw `ReferenceError: Cannot access 'TRUSTED_DATA_CONFIRMATION'
 * before initialization`, because a module-scope call in `function` read a
 * `const` still in its TDZ mid-cycle (ADR #070). The barrel masked it (its order
 * saves it) and the bundler masked it (it flattens the cycle), so only a raw
 * entry exposed it.
 *
 * This arena is the permanent fixture for that seam: for every subpath the
 * package publishes (`exports` in `package.json`), spawn a fresh Node process
 * that imports the source entry as its own entry point and assert it loads
 * without throwing. The subpaths' internal `#…` specifiers resolve natively
 * through the package's `imports` map — no test shim — so this exercises the
 * exact resolution a consumer's Node performs. The entry set is DERIVED from
 * `exports` (each subpath's `types` `./src/x.d.ts` → its source `./src/x.js`),
 * so a newly-published subpath is automatically in the arena rather than
 * silently uncovered.
 *
 * This tests the code's ARRIVAL, not its behavior; the behavioral suites live
 * per module. Consumer-side type resolution (the shipped `#…` specifiers) is the
 * sibling delivery-seam concern, verified by `tsc` at the package level.
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';

import pkg from '../package.json';

const PACKAGE_ROOT = new URL('../', import.meta.url);

const ENTRIES = Object.entries(pkg.exports).map(([subpath, condition]) => ({
  subpath,
  url: new URL(condition.types.replace(/\.d\.ts$/, '.js'), PACKAGE_ROOT),
}));

/**
 * Load `url` as its own entry point in a fresh Node process. Its internal `#…`
 * specifiers resolve natively via the package's `imports` map.
 *
 * @param {URL} url - the source entry file to import as the process entry
 */
function loadAsEntryPoint(url) {
  return spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(url.href)})`],
    { encoding: 'utf8' },
  );
}

describe('entry-point arena — every published subpath loads clean as its own entry', () => {
  it('derives a non-empty entry set from package.json `exports`', () => {
    expect(ENTRIES.length).toBeGreaterThan(0);
    expect(ENTRIES.map((entry) => entry.subpath)).toContain('.');
  });

  it.each(ENTRIES)(
    'loads "$subpath" as its own entry point without throwing',
    ({ url }) => {
      const { status, stderr } = loadAsEntryPoint(url);
      // Surface the actual load failure — a TDZ crash reads clearly here.
      expect(stderr).not.toMatch(/before initialization/);
      expect(status).toBe(0);
    },
  );
});

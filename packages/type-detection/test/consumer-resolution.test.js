// @ts-check

/**
 * @module test/consumer-resolution
 *
 * Axis 5 — the delivery seam, type side. The package ships its type surface as
 * source declarations: `package.json` `types` (and every `exports` subpath's
 * `types`) points at `./src/*.d.ts`. Those declarations reference sibling
 * modules by `#…` subpath specifiers, which resolve through the package's own
 * `imports` map — the map that ships inside `package.json`. A `@/`-style alias,
 * which lived only in this workspace's tsconfig/vite, did NOT ship, so every
 * internal import in a shipped `.d.ts` was `TS2307` at a consumer's compiler
 * (ADR #071). No test caught it because every in-repo compile ran with the
 * workspace path config in scope.
 *
 * This fixture stands a compiler in a consumer's position: it typechecks every
 * shipped `types` entry (derived from `exports`, so a new subpath is covered
 * automatically) under a minimal, workspace-agnostic config — `bundler`
 * resolution, no `paths`, no `@/`/`#` aliasing of its own — relying solely on
 * what the package publishes. A shipped specifier that a downstream compiler
 * cannot resolve surfaces here as `Cannot find module … (TS2307)`, turning the
 * delivery seam's type half into a guarded property rather than a one-time
 * check. The runtime half is `entry-arena.test.js`.
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pkg from '../package.json';

const require = createRequire(import.meta.url);
const TSC = require.resolve('typescript/bin/tsc');
const PACKAGE_ROOT = new URL('../', import.meta.url);

// The declaration files a consumer actually receives — one per published
// subpath's `types`, deduped, as forward-slash absolute paths (tsconfig-safe on
// every platform).
const SHIPPED_TYPES = [
  ...new Set(Object.values(pkg.exports).map((condition) => condition.types)),
].map((relative) => fileURLToPath(new URL(relative, PACKAGE_ROOT)).replace(/\\/g, '/'));

describe('consumer-resolution — shipped types resolve at a downstream compiler', () => {
  it('derives a non-empty type set from package.json `exports`', () => {
    expect(SHIPPED_TYPES.length).toBeGreaterThan(0);
  });

  it('typechecks every shipped `types` entry with no workspace path config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'species-consumer-'));
    try {
      writeFileSync(
        join(dir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            noEmit: true,
            strict: true,
            module: 'esnext',
            moduleResolution: 'bundler',
            lib: ['ES2020', 'DOM', 'DOM.Iterable'],
            skipLibCheck: false,
            types: [],
          },
          files: SHIPPED_TYPES,
        }),
      );

      const { status, stdout, stderr } = spawnSync(
        process.execPath,
        [TSC, '-p', join(dir, 'tsconfig.json')],
        { encoding: 'utf8' },
      );
      const output = `${stdout}${stderr}`;

      // An unshipped/aliased specifier in a shipped `.d.ts` reads clearly here.
      expect(output).not.toMatch(/Cannot find module/);
      expect(output).not.toMatch(/error TS/);
      expect(status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    // Spawning `tsc` is slow — and slower still under the parallel coverage run
    // on a loaded machine (~12s observed) — so this test needs a generous ceiling.
  }, 60000);
});

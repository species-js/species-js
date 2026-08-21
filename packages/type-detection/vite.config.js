// @ts-check

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const buildTarget = process.env.SPECIES_BUILD_TARGET ?? 'node';

const isNode = buildTarget === 'node';
const isUmd = buildTarget === 'umd';

// Coverage thresholds are enforced only once the package is PUBLISHED — the same
// `private`-gated rule the delivery-seam gates use (`smoke:check`, `entries:check`).
// A scaffold has no consumer to protect, and before it has a surface there is
// nothing to measure: v8 scores 0/0 as 100%, so a threshold asserts nothing there
// anyway. Coverage still RUNS and reports, so the numbers stay visible while the
// package grows.
//
// TRIP CONDITION — dropping `private` from this package's manifest restores the
// workspace thresholds in full, and an untested surface fails the build from that
// commit on. That is deliberate: the gate lifts itself rather than waiting to be
// remembered.
/** @type {unknown} */
const manifest = JSON.parse(
  readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8'),
);
const isPublished =
  !(typeof manifest === 'object' && manifest !== null && 'private' in manifest) ||
  manifest.private !== true;

export default defineConfig({
  build: {
    // Vite's own default for an in-root `outDir`, made explicit. Each target owns a
    // separate `dist/<target>`, so emptying one cannot reach its siblings — verified.
    // Left at `false` by the initial scaffold, it let every content-hashed chunk from
    // every previous build accumulate, and `files: ["dist", "src"]` packs them.
    emptyOutDir: true,
    lib: {
      entry: isUmd
        ? { public: resolve(import.meta.dirname, 'src/public.js') }
        : {
            // The published root entry is the CURATED barrel, never `src/index.js`
            // — that one stars every subdomain and carries the `@internal`
            // machinery with it. It is reachable in-package as `#index` (the test
            // suite imports it) and is deliberately never built.
            public: resolve(import.meta.dirname, 'src/public.js'),
            config: resolve(import.meta.dirname, 'src/config/index.js'),
            utility: resolve(import.meta.dirname, 'src/utility/index.js'),
            function: resolve(import.meta.dirname, 'src/function.js'),
            primitive: resolve(import.meta.dirname, 'src/primitive.js'),
            error: resolve(import.meta.dirname, 'src/error.js'),
            object: resolve(import.meta.dirname, 'src/object.js'),
            evented: resolve(import.meta.dirname, 'src/evented.js'),
            thenable: resolve(import.meta.dirname, 'src/thenable.js'),
          },
      fileName: (format, entryName) => {
        if (format === 'cjs') {
          return `${entryName}.cjs`;
        }
        if (format === 'umd') {
          return `${entryName}.umd.js`;
        }
        return `${entryName}.js`;
      },
      formats: isNode ? ['es', 'cjs'] : isUmd ? ['umd'] : ['es'],
      ...(isUmd && { name: 'SpeciesJS.TypeDetection' }),
    },
    minify: isUmd ? 'esbuild' : false,
    outDir: `dist/${buildTarget}`,
    sourcemap: true,
    target: isUmd ? 'es2020' : isNode ? 'node22' : 'es2020',
  },
  test: {
    coverage: {
      include: ['src/**/*.js'],
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      ...(isPublished && {
        thresholds: {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      }),
    },
    environment: 'node',
    include: ['test/**/*.test.js'],
  },
});

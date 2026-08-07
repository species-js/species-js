// @ts-check

import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const buildTarget = process.env.SPECIES_BUILD_TARGET ?? 'node';

const isNode = buildTarget === 'node';
const isUmd = buildTarget === 'umd';

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: isUmd
        ? { index: resolve(import.meta.dirname, 'src/index.js') }
        : {
            index: resolve(import.meta.dirname, 'src/index.js'),
            bound: resolve(import.meta.dirname, 'src/bound.js'),
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
      ...(isUmd && { name: 'SpeciesJS.FunctionIntrospection' }),
    },
    minify: isUmd ? 'esbuild' : false,
    outDir: `dist/${buildTarget}`,
    rollupOptions: {
      external: isUmd ? [] : ['@species-js/type-detection'],
    },
    sourcemap: true,
    target: isUmd ? 'es2020' : isNode ? 'node22' : 'es2020',
  },
  test: {
    // The workspace dependency resolves through type-detection's own exports
    // map, whose runtime entries point into `dist/`. On a fresh checkout that
    // directory does not exist yet — CI runs Test before Build — so every test
    // file failed to load with "Failed to resolve entry for package". It passed
    // locally only because a previously built `dist/` happened to be lying
    // around, which is a green underwritten by an artifact nobody re-derived.
    //
    // Tests run against SOURCE instead. Artifact correctness is a separate
    // concern and already has its own gates after the build step (`pack:check`,
    // `check:publish`). The target is deliberately `src/public.js` rather than
    // `src/index.js`: it makes every cross-package import prove it consumes
    // only type-detection's curated public surface (ADR #085), which nothing
    // else currently enforces across a package boundary.
    //
    // Exact-match regex, not a bare string — a string alias also rewrites
    // subpath specifiers (`…/foo` → `<path>/foo`), which would silently
    // redirect an import this package does not currently make.
    alias: [
      {
        find: /^@species-js\/type-detection$/,
        replacement: resolve(import.meta.dirname, '../type-detection/src/public.js'),
      },
    ],
    coverage: {
      include: ['src/**/*.js'],
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      thresholds: {
        branches: 85,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
    environment: 'node',
    include: ['test/**/*.test.js'],
  },
});

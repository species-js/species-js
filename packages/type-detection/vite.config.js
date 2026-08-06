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

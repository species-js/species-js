// @ts-check

import { defineConfig } from 'vitest/config';

/**
 * Root Vitest orchestration.
 *
 * Each package owns its own Vite/Vitest settings — including coverage provider,
 * include patterns, reporters, and thresholds. This root file only discovers
 * the per-package projects; it does not redeclare coverage configuration.
 */
export default defineConfig({
  test: {
    projects: ['packages/*/vite.config.js'],
  },
});

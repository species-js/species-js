// @ts-check

import { describe, it, expect } from 'vitest';

describe('@species-js/function-introspection', () => {
  it('should be importable', async () => {
    const mod = await import('@/index.js');

    expect(mod).toBeDefined();
  });
});

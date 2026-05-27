// @ts-check

import { describe, it, expect } from 'vitest';

describe('@species-js/type-identity', () => {
  it('should be importable', async () => {
    const mod = await import('@/index.js');

    expect(mod).toBeDefined();
  });
});

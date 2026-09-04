// @ts-check

import { describe, it, expect } from 'vitest';

describe('@species-js/custom-namespace', () => {
  it('should be importable', async () => {
    const mod = await import('#index');

    expect(mod).toBeDefined();
  });
});

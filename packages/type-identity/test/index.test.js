// @ts-check

import { describe, it, expect } from 'vitest';

import {
  brandFunctionName,
  defineStableTypeIdentity,
  doesCarryStableTypeIdentity,
} from '#index';

describe('@species-js/type-identity', () => {
  it('should be importable', async () => {
    const mod = await import('#index');

    expect(mod).toBeDefined();
  });

  describe('the module surface (ADR #099 — whatever `exports["."]` resolves to is public)', () => {
    /**
     * The escape boundary is `#public`, not `#index`. `#index` is the module
     * itself: it additionally exports the two parameter verifiers and the
     * error-cause seam so their admissions and refusals can be asserted
     * directly, and it is what the suites import. `#public` is what
     * `exports["."]` resolves to, so it alone decides what a consumer reaches.
     *
     * `surface:check` asserts the same boundary statically, by reading the
     * `@internal` tags. This asserts it at runtime, where a name either is or
     * is not on the object a consumer imports.
     */
    const publicNames = [
      'brandFunctionName',
      'defineStableTypeIdentity',
      'doesCarryStableTypeIdentity',
    ];

    const internalNames = [
      'getIdentifierAsSafeResult',
      'isSupportedConstructor',
      'resolveErrorWithCause',
    ];

    it('exports exactly the three documented entries through the curated public entry', async () => {
      const entry = await import('#public');

      expect(
        Object.keys(entry).sort(),
        'the published surface, named one by one',
      ).toEqual(publicNames);
    });

    it('lets nothing `@internal` escape through that entry', async () => {
      const entry = await import('#public');

      expect(
        internalNames.filter((name) => name in entry),
        'an @internal value reachable by a consumer',
      ).toEqual([]);
    });

    it('the module itself deliberately carries all six', async () => {
      const barrel = await import('#index');

      expect(
        [...publicNames, ...internalNames].filter((name) => name in barrel),
        '#index is the internal surface — narrowing it would break the suites',
      ).toEqual([...publicNames, ...internalNames]);
    });

    it('the escaping exports are the same function objects the module defines', async () => {
      const entry = /** @type {Record<string, unknown>} */ (await import('#public'));

      expect(entry.brandFunctionName).toBe(brandFunctionName);
      expect(entry.defineStableTypeIdentity).toBe(defineStableTypeIdentity);
      expect(entry.doesCarryStableTypeIdentity).toBe(doesCarryStableTypeIdentity);
    });
  });
});

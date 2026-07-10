// @ts-check

/**
 * @module test/error/cross-realm
 *
 * Axis 2 — cross-realm. A foreign-realm `Error` / `DOMException` has the SAME
 * structural shape as a local one but a DIFFERENT intrinsic identity, so local
 * `instanceof` misses and the alien-walk structural arm must carry the verdict.
 *
 * `Error` IS an ECMAScript intrinsic (a REAL foreign Error is constructible in
 * the vm realm); `DOMException` is NOT (a WHATWG global), so the foreign
 * DOMException is a SYNTHETIC — a foreign class carrying the `[object DOMException]`
 * tag + WeakMap-backed name/message getters — the browser-DOMException stand-in
 * the cross-realm structural arm is designed to admit.
 *
 * Also pins the ACCEPTED realm-asymmetry (ADR #069, spec isGenericError/B2 +
 * iARGE/B1): a foreign flattened `DOMException` — no cross-realm identity guard —
 * is classified as a generic `Error`.
 *
 * Mirrors the "Cross-realm (axis 2)" expectations in `docs/spec/ERROR.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import {
  isGenericError,
  isDOMException,
  isError,
  isAbortError,
  isAlienRealmGenericError,
  isAlienRealmDOMException,
} from '@/index.js';

import {
  foreignError,
  foreignTypeError,
  foreignErrorSubclass,
  foreignDomException,
  foreignPlainErrorShaped,
  foreignFlattenedDomException,
} from './__config.js';

describe('error — cross-realm (axis 2)', () => {
  it('isGenericError/A4 + isError/A4: a foreign Error / TypeError / subclass → generic Error, not DOMException', () => {
    for (const make of [foreignError, foreignTypeError, foreignErrorSubclass]) {
      const foreign = make();
      expect(isGenericError(foreign), 'isGenericError').toBe(true);
      expect(isDOMException(foreign), 'isDOMException').toBe(false);
      expect(isError(foreign), 'isError').toBe(true);
      expect(isAbortError(foreign), 'isAbortError').toBe(false);
    }
  });

  it('isDOMException/A4: a foreign DOMException synthetic → DOMException, not generic', () => {
    const foreign = foreignDomException();
    expect(isDOMException(foreign), 'isDOMException').toBe(true);
    expect(isGenericError(foreign), 'isGenericError').toBe(false);
    expect(isError(foreign), 'isError').toBe(true);
  });

  it('a foreign non-error (plain `{ name, message }`) → all four false', () => {
    const foreign = foreignPlainErrorShaped();
    expect(isGenericError(foreign), 'isGenericError').toBe(false);
    expect(isDOMException(foreign), 'isDOMException').toBe(false);
    expect(isError(foreign), 'isError').toBe(false);
    expect(isAbortError(foreign), 'isAbortError').toBe(false);
  });

  it('the alien-realm arms carry the foreign verdict directly (local instanceof missed)', () => {
    expect(isAlienRealmGenericError(foreignError()), 'iARGE(foreign Error)').toBe(true);
    expect(
      isAlienRealmGenericError(foreignDomException()),
      'iARGE(foreign DOMException)',
    ).toBe(false);
    expect(
      isAlienRealmDOMException(foreignDomException()),
      'iARDE(foreign DOMException)',
    ).toBe(true);
    expect(isAlienRealmDOMException(foreignError()), 'iARDE(foreign Error)').toBe(false);
  });

  describe('the accepted realm-asymmetry (ADR #069)', () => {
    it('isGenericError/B2 + iARGE/B1: a foreign FLATTENED DOMException is classified as a generic Error', () => {
      const foreign = foreignFlattenedDomException();
      // no cross-realm identity guard: its broken contract fails isDOMException,
      // and the structural arm reads it as an Error.
      expect(isDOMException(foreign), 'isDOMException').toBe(false);
      expect(isGenericError(foreign), 'isGenericError').toBe(true);
      expect(isError(foreign), 'isError').toBe(true);
      // still self-consistent (not a partition-law violation): disjoint + cover hold.
      expect(isGenericError(foreign) && isDOMException(foreign), 'disjoint').toBe(false);
    });

    it('the CURRENT-realm counterpart is excluded by identity — the asymmetry', () => {
      // a LOCAL flattened DOMException subclass → NEITHER arm (isGenericError F),
      // because instanceof reaches it where the foreign structural arm cannot.
      const local = new (class extends DOMException {
        /** @override */
        name = 'Flattened';
      })('m');
      expect(isGenericError(local), 'local isGenericError').toBe(false);
      expect(isDOMException(local), 'local isDOMException').toBe(false);
    });
  });
});

// @ts-check

/**
 * @module test/error/invariants
 *
 * Standing structural-invariant oracle — the spec-free RELATIONSHIP laws of the
 * error PARTITION, asserted over a broad value corpus. Promoted from the
 * back-sweep's ephemeral hostile-probe into a committed, always-run suite
 * (Phase 2): these laws are genuinely NEW coverage the absolute-value matrices in
 * `spec.test.js` do not assert — the matrices pin each value's verdict QUAD; this
 * suite pins the CROSS-PREDICATE relationships that must hold for EVERY value,
 * hostile ones included.
 *
 * ```
 *   isError  →  AnyError = Error | DOMException      (public; native or the isAnyError polyfill)
 *      isGenericError  ⊎  isDOMException             (DISJOINT arms)
 *      isAbortError  refines isError by a name-suffix match
 * ```
 *
 * The laws:
 *   A. PARTITION COVER (the headline) — `isAnyError(v) === isGenericError(v) ||
 *      isDOMException(v)` for EVERY `v`. The load-bearing spec invariant
 *      (`isError ≡ isGenericError ⊎ isDOMException`), asserted on the DETERMINISTIC
 *      polyfill body `isAnyError` (not the public `isError`, whose binding is native
 *      OR polyfill — native `Error.isError(DOMException)` membership is the open
 *      policy flag, so the deterministic body is the engine-independent oracle).
 *   B. DISJOINTNESS — no value is both `isGenericError` and `isDOMException`.
 *   C. Refinement — each arm implies the polyfill (`isGenericError`/`isDOMException`
 *      ⇒ `isAnyError`), and `isAbortError ⇒ isError` (it composes `isError`).
 *   D. Cross-realm verdict symmetry — an UNTAMPERED shape reads identically local vs
 *      foreign, on the deterministic triple `[isGenericError, isDOMException,
 *      isAnyError]`. The deliberately-asymmetric FOREIGN flattened `DOMException`
 *      (classified generic cross-realm, NEITHER locally) is excluded by design and
 *      asserted AS asymmetric, pinning the #069 realm-asymmetry boundary.
 *   E. Falsy floor — every public predicate rejects every falsy input.
 *   F. Determinism — repeated calls on the same instance agree (no hidden state).
 *   G. Witnesses — the partition does not collapse: a generic-not-DOMException, a
 *      DOMException-not-generic, an abort error, and a "NEITHER arm" value (a
 *      broken-contract DOMException instance) all exist.
 *
 * Throw-safety (that no predicate throws on hostile input) is the axis-5 concern —
 * see `throw-safety.test.js`; this suite assumes it and asserts relationships.
 */

import { describe, it, expect } from 'vitest';

import {
  isGenericError,
  isDOMException,
  isError,
  isAbortError,
  isAnyError,
} from '#index';

import {
  plainError,
  typeError,
  rangeError,
  errorSubclassInstance,
  namedErrorSubclass,
  domException,
  abortDomException,
  domExceptionSubclass,
  timeoutAbortError,
  errorNamedAbort,
  plainErrorShaped,
  bareDomExceptionGraft,
  ownGetterNameGraft,
  ownDataNameGraft,
  ownDataMessageGraft,
  chromeStandInDomException,
  errorPrototypeGraft,
  flattenedDomExceptionSubclass,
  tagSpoofedDomException,
  throwingGetterNameGraft,
  foreignError,
  foreignTypeError,
  foreignErrorSubclass,
  foreignPlainErrorShaped,
  foreignDomException,
  foreignFlattenedDomException,
  prototypeTrapProxy,
  valueOverDescriptorTrap,
  throwingNameError,
  throwingMessageError,
  throwingOwnKeysProto,
} from './__config.js';

// The full value corpus — clean errors across both arms, graft/boundary shapes,
// hostile traps, and foreign-realm values. The relationship laws must hold across
// ALL of them.
/** @type {Array<[string, () => unknown]>} */
const corpus = [
  ['plainError', plainError],
  ['typeError', typeError],
  ['rangeError', rangeError],
  ['errorSubclassInstance', errorSubclassInstance],
  ['namedErrorSubclass', namedErrorSubclass],
  ['domException', domException],
  ['abortDomException', abortDomException],
  ['domExceptionSubclass', domExceptionSubclass],
  ['timeoutAbortError', timeoutAbortError],
  ['errorNamedAbort', errorNamedAbort],
  ['plainErrorShaped', plainErrorShaped],
  ['bareDomExceptionGraft', bareDomExceptionGraft],
  ['ownGetterNameGraft', ownGetterNameGraft],
  ['ownDataNameGraft', ownDataNameGraft],
  ['ownDataMessageGraft', ownDataMessageGraft],
  ['chromeStandInDomException', chromeStandInDomException],
  ['errorPrototypeGraft', errorPrototypeGraft],
  ['flattenedDomExceptionSubclass', flattenedDomExceptionSubclass],
  ['tagSpoofedDomException', tagSpoofedDomException],
  ['throwingGetterNameGraft', throwingGetterNameGraft],
  ['foreignError', foreignError],
  ['foreignTypeError', foreignTypeError],
  ['foreignErrorSubclass', foreignErrorSubclass],
  ['foreignPlainErrorShaped', foreignPlainErrorShaped],
  ['foreignDomException', foreignDomException],
  ['foreignFlattenedDomException', foreignFlattenedDomException],
  ['prototypeTrapProxy', prototypeTrapProxy],
  ['valueOverDescriptorTrap', valueOverDescriptorTrap],
  ['throwingNameError', throwingNameError],
  ['throwingMessageError', throwingMessageError],
  ['throwingOwnKeysProto', throwingOwnKeysProto],
];

const falsyFloor = [null, undefined, 0, '', false, NaN, 0n];

describe('error — structural invariants (A: PARTITION COVER — isAnyError === generic ∨ DOMException)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: isAnyError === isGenericError || isDOMException`, () => {
      const v = make();
      // the load-bearing invariant, on the deterministic polyfill body: every value
      // is classified into exactly the union of the two arms.
      expect(isAnyError(v)).toBe(isGenericError(v) || isDOMException(v));
    });
  }
});

describe('error — structural invariants (B: DISJOINTNESS — never both arms)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: !(isGenericError && isDOMException)`, () => {
      const v = make();
      expect(isGenericError(v) && isDOMException(v)).toBe(false);
    });
  }
});

describe('error — structural invariants (C: refinement)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: each arm ⇒ isAnyError, and isAbortError ⇒ isError`, () => {
      const v = make();
      expect(
        !isGenericError(v) || isAnyError(v),
        `${label}: generic but not AnyError`,
      ).toBe(true);
      expect(
        !isDOMException(v) || isAnyError(v),
        `${label}: DOMException but not AnyError`,
      ).toBe(true);
      // isAbortError composes isError, so it can never hold where isError does not.
      expect(!isAbortError(v) || isError(v), `${label}: abort but not error`).toBe(true);
    });
  }
});

describe('error — structural invariants (D: cross-realm verdict symmetry)', () => {
  // UNTAMPERED shapes read identically across realms on the DETERMINISTIC triple —
  // no verdict depends on realm membership alone. (`isError` is excluded from the
  // triple: its binding is native OR polyfill, and a native engine could classify a
  // foreign synthetic differently — the open policy flag; the deterministic arms do
  // not.)
  /** @type {Array<[string, () => unknown, () => unknown]>} */
  const untamperedPairs = [
    ['Error', plainError, foreignError],
    ['TypeError', typeError, foreignTypeError],
    ['Error subclass', errorSubclassInstance, foreignErrorSubclass],
    ['DOMException', domException, foreignDomException],
    ['non-error error-shaped', plainErrorShaped, foreignPlainErrorShaped],
  ];

  for (const [label, local, foreign] of untamperedPairs) {
    it(`${label}: [isGenericError, isDOMException, isAnyError] is realm-independent`, () => {
      /** @param {unknown} v - the value to score across the deterministic triple */
      const triple = (v) => [isGenericError(v), isDOMException(v), isAnyError(v)];
      expect(triple(foreign()), `${label}: foreign ≠ local`).toEqual(triple(local()));
    });
  }

  it('the FOREIGN flattened DOMException is DELIBERATELY asymmetric (the #069 residual)', () => {
    // the boundary of law D: a broken-contract (flattened-name) DOMException reads as
    // NEITHER arm locally (identity exclusion + rejected getter contract) but as a
    // generic Error cross-realm (no cross-realm identity guard; it is Error-shaped with
    // a reachable stack). Same provenance, opposite generic-verdict by realm, by design.
    const localFlattened = flattenedDomExceptionSubclass();
    expect(isGenericError(localFlattened), 'local: neither arm').toBe(false);
    expect(isDOMException(localFlattened), 'local: not DOMException').toBe(false);

    const foreignFlattened = foreignFlattenedDomException();
    expect(isGenericError(foreignFlattened), 'foreign: classified generic').toBe(true);
    expect(isDOMException(foreignFlattened), 'foreign: not DOMException').toBe(false);
  });
});

describe('error — structural invariants (E: falsy floor)', () => {
  for (const value of falsyFloor) {
    it(`${String(value)}: all four public predicates reject`, () => {
      expect(isGenericError(value), 'isGenericError').toBe(false);
      expect(isDOMException(value), 'isDOMException').toBe(false);
      expect(isError(value), 'isError').toBe(false);
      expect(isAbortError(value), 'isAbortError').toBe(false);
    });
  }
});

describe('error — structural invariants (F: determinism)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: repeated calls on the same instance agree`, () => {
      const v = make();
      expect(isGenericError(v)).toBe(isGenericError(v));
      expect(isDOMException(v)).toBe(isDOMException(v));
      expect(isAnyError(v)).toBe(isAnyError(v));
      expect(isAbortError(v)).toBe(isAbortError(v));
    });
  }
});

describe('error — structural invariants (G: the partition does not collapse)', () => {
  it('a generic Error that is NOT a DOMException exists (`new Error`)', () => {
    const v = plainError();
    expect(isGenericError(v)).toBe(true);
    expect(isDOMException(v)).toBe(false);
  });

  it('a DOMException that is NOT a generic Error exists (`new DOMException`)', () => {
    const v = domException();
    expect(isDOMException(v)).toBe(true);
    expect(isGenericError(v)).toBe(false);
  });

  it('an abort error exists (a DOMException named `AbortError`)', () => {
    expect(isAbortError(abortDomException())).toBe(true);
  });

  it('a value classified as NEITHER arm exists (a broken-contract DOMException instance)', () => {
    // a flattened-name DOMException subclass: still `instanceof DOMException` (so
    // excluded from the generic arm by identity) yet failing the getter contract (so
    // rejected by isDOMException) — it lands as neither, and isAnyError agrees.
    const v = flattenedDomExceptionSubclass();
    expect(isGenericError(v)).toBe(false);
    expect(isDOMException(v)).toBe(false);
    expect(isAnyError(v)).toBe(false);
  });
});

// @ts-check

/**
 * @module test/thenable/invariants
 *
 * Standing structural-invariant oracle — the spec-free RELATIONSHIP laws of the
 * thenable lattice, asserted over a broad value corpus. Promoted from the
 * back-sweep's ephemeral hostile-probe into a committed, always-run suite
 * (Phase 2): these laws are genuinely NEW coverage the absolute-value matrices in
 * `spec.test.js` do not assert — the matrices pin each value's verdict TRIPLE;
 * this suite pins the CROSS-PREDICATE relationships that must hold for EVERY value,
 * hostile ones included.
 *
 * ```
 * Thenable<T>              (isThenable)     — callable `then` only
 *   └── PromiseLike<T>     (isPromiseLike)  — full Promise.prototype method contract
 *         └── Promise<T>   (isPromise)      — Promise identity (two-axis dispatch)
 * ```
 *
 * The laws:
 *   A. Refinement monotonicity — `isPromise(v) ⇒ isPromiseLike(v) ⇒ isThenable(v)`
 *      for every `v` (the strict-superset chain, read as implication). The single
 *      strongest universal law; a violation is a real defect regardless of spec.
 *   B. Falsy floor — every predicate rejects every falsy input (the `!!value` gate).
 *   C. Cross-realm verdict symmetry — an UNTAMPERED promise shape reads identically
 *      local vs foreign. Deliberately-asymmetric tampered grafts (the #063 residual:
 *      a cosmetic-tag graft admitted locally, rejected cross-realm) are excluded by
 *      design and asserted AS asymmetric, so the law's boundary is pinned too.
 *   D. Determinism — repeated calls on the same instance agree (no hidden state).
 *   E. Strictness witnesses — the chain does not collapse: a Thenable-not-PromiseLike
 *      and a PromiseLike-not-Promise value both exist.
 *
 * Throw-safety (that no predicate throws on hostile input) is the axis-5 concern —
 * see `throw-safety.test.js`; this suite assumes it and asserts relationships.
 */

import { describe, it, expect } from 'vitest';

import { isThenable, isPromiseLike, isPromise } from '#index';

import {
  localPromise,
  localPromiseViaConstructor,
  promiseSubclassInstance,
  ownThenable,
  inheritedThenable,
  callableThenable,
  fullContract,
  userlandPromiseLike,
  nonCallableThen,
  thenCatchOnly,
  classThen,
  nullProtoOwnThen,
  ownNonCallableShadowsThen,
  accessorThen,
  accessorFinally,
  tagSpoofedPromise,
  nullProtoTagSpoofedPromise,
  ownConstructorNamedPromise,
  promisePrototypeGraft,
  promiseMethodShadowGraft,
  promiseConstructorShadowGraft,
  promiseGraftWithOrthogonalState,
  taggedPromiseGraftLocal,
  taggedPromiseGraftForeign,
  ownKeysTrapOverPromiseProto,
  throwingGetterThen,
  throwingGetterCatchAfterThen,
  throwingDescTrapProxy,
  throwingProtoTrapProxy,
  throwingTagGetterWithContract,
  taggedPromiseOverThrowingProtoTrap,
  foreignPromise,
  foreignPromiseSubclassInstance,
} from './__config.js';

// The full value corpus — clean shapes, spoof/graft boundaries, hostile traps, and
// foreign-realm values. The relationship laws must hold across ALL of them, so the
// corpus is deliberately as adversarial as the module's whole test surface.
/** @type {Array<[string, () => unknown]>} */
const corpus = [
  ['localPromise', localPromise],
  ['localPromiseViaConstructor', localPromiseViaConstructor],
  ['promiseSubclassInstance', promiseSubclassInstance],
  ['ownThenable', ownThenable],
  ['inheritedThenable', inheritedThenable],
  ['callableThenable', callableThenable],
  ['fullContract', fullContract],
  ['userlandPromiseLike', userlandPromiseLike],
  ['nonCallableThen', nonCallableThen],
  ['thenCatchOnly', thenCatchOnly],
  ['classThen', classThen],
  ['nullProtoOwnThen', nullProtoOwnThen],
  ['ownNonCallableShadowsThen', ownNonCallableShadowsThen],
  ['accessorThen', accessorThen],
  ['accessorFinally', accessorFinally],
  ['tagSpoofedPromise', tagSpoofedPromise],
  ['nullProtoTagSpoofedPromise', nullProtoTagSpoofedPromise],
  ['ownConstructorNamedPromise', ownConstructorNamedPromise],
  ['promisePrototypeGraft', promisePrototypeGraft],
  ['promiseMethodShadowGraft', promiseMethodShadowGraft],
  ['promiseConstructorShadowGraft', promiseConstructorShadowGraft],
  ['promiseGraftWithOrthogonalState', promiseGraftWithOrthogonalState],
  ['taggedPromiseGraftLocal', taggedPromiseGraftLocal],
  ['taggedPromiseGraftForeign', taggedPromiseGraftForeign],
  ['ownKeysTrapOverPromiseProto', ownKeysTrapOverPromiseProto],
  ['throwingGetterThen', throwingGetterThen],
  ['throwingGetterCatchAfterThen', throwingGetterCatchAfterThen],
  ['throwingDescTrapProxy', throwingDescTrapProxy],
  ['throwingProtoTrapProxy', throwingProtoTrapProxy],
  ['throwingTagGetterWithContract', throwingTagGetterWithContract],
  ['taggedPromiseOverThrowingProtoTrap', taggedPromiseOverThrowingProtoTrap],
  ['foreignPromise', foreignPromise],
  ['foreignPromiseSubclassInstance', foreignPromiseSubclassInstance],
];

const falsyFloor = [null, undefined, 0, '', false, NaN, 0n];

describe('thenable — structural invariants (A: refinement monotonicity)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: isPromise ⇒ isPromiseLike ⇒ isThenable`, () => {
      const v = make();
      const is = isPromise(v);
      const like = isPromiseLike(v);
      const then = isThenable(v);
      // implication A ⇒ B is `!A || B`; asserted as a chain so a break names which
      // rung collapsed (a Promise that is not PromiseLike, or a PromiseLike that is
      // not a Thenable — either is a lattice defect).
      expect(!is || like, `${label}: isPromise but not isPromiseLike`).toBe(true);
      expect(!like || then, `${label}: isPromiseLike but not isThenable`).toBe(true);
    });
  }
});

describe('thenable — structural invariants (B: falsy floor)', () => {
  for (const value of falsyFloor) {
    it(`${String(value)}: all three predicates reject`, () => {
      expect(isThenable(value), 'isThenable').toBe(false);
      expect(isPromiseLike(value), 'isPromiseLike').toBe(false);
      expect(isPromise(value), 'isPromise').toBe(false);
    });
  }
});

describe('thenable — structural invariants (C: cross-realm verdict symmetry)', () => {
  // UNTAMPERED promise shapes read identically across realms — no verdict depends
  // on realm membership alone.
  /** @type {Array<[string, () => unknown, () => unknown]>} */
  const untamperedPairs = [
    ['direct Promise', localPromise, foreignPromise],
    ['Promise subclass', promiseSubclassInstance, foreignPromiseSubclassInstance],
  ];

  for (const [label, local, foreign] of untamperedPairs) {
    it(`${label}: [isThenable, isPromiseLike, isPromise] is realm-independent`, () => {
      const l = local();
      const f = foreign();
      /** @param {unknown} v - the value to score across the three chain predicates */
      const triple = (v) => [isThenable(v), isPromiseLike(v), isPromise(v)];
      expect(triple(f), `${label}: foreign ≠ local`).toEqual(triple(l));
    });
  }

  it('the tampered cosmetic-tag graft is DELIBERATELY asymmetric (#063 residual)', () => {
    // the boundary of law C: a spoofed-tag Promise-prototype graft is admitted by
    // the tag-blind LOCAL identity arm but rejected by the tag-reading cross-realm
    // arm — the same shape, opposite `isPromise` verdict by realm, by design.
    expect(isPromise(taggedPromiseGraftLocal()), 'local admit').toBe(true);
    expect(isPromise(taggedPromiseGraftForeign()), 'foreign reject').toBe(false);
  });
});

describe('thenable — structural invariants (D: determinism)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: repeated calls on the same instance agree`, () => {
      const v = make();
      expect(isThenable(v)).toBe(isThenable(v));
      expect(isPromiseLike(v)).toBe(isPromiseLike(v));
      expect(isPromise(v)).toBe(isPromise(v));
    });
  }
});

describe('thenable — structural invariants (E: the chain is strict, not collapsed)', () => {
  it('a Thenable that is NOT PromiseLike exists (ownThenable)', () => {
    const v = ownThenable();
    expect(isThenable(v)).toBe(true);
    expect(isPromiseLike(v)).toBe(false);
  });

  it('a PromiseLike that is NOT a Promise exists (userlandPromiseLike)', () => {
    const v = userlandPromiseLike();
    expect(isPromiseLike(v)).toBe(true);
    expect(isPromise(v)).toBe(false);
  });
});

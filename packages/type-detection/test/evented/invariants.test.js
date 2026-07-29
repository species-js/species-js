// @ts-check

/**
 * @module test/evented/invariants
 *
 * Standing structural-invariant oracle — the spec-free RELATIONSHIP laws of the two
 * evented lattices, asserted over a broad value corpus. Promoted from the
 * back-sweep's ephemeral hostile-probe into a committed, always-run suite
 * (Phase 2): these laws are genuinely NEW coverage the absolute-value matrices in
 * `spec.test.js` do not assert — the matrices pin each value's verdict QUAD; this
 * suite pins the CROSS-PREDICATE relationships that must hold for EVERY value,
 * hostile ones included.
 *
 * ```
 * EventTargetLike (isEventTargetLike) ─── EventTarget (isEventTarget)
 * AbortSignalLike (isAbortSignalLike) ─── AbortSignal (isAbortSignal)
 *   AbortSignalLike extends EventTargetLike   (every abort-signal-like is event-target-like)
 * ```
 *
 * The laws:
 *   A. Refinement — `isEventTarget ⇒ isEventTargetLike`, `isAbortSignal ⇒
 *      isAbortSignalLike`, and the LATTICE-EXTENDS law `isAbortSignalLike ⇒
 *      isEventTargetLike` (an AbortSignalLike is an EventTargetLike). NOTE the chain
 *      does NOT include `isAbortSignal ⇒ isEventTarget`: a real AbortSignal is an
 *      EventTarget *instance* but NOT a direct EventTarget (its `[[Prototype]]` is
 *      `AbortSignal.prototype`), so `isEventTarget(signal)` is false — see law B.
 *   B. Strict-tier disjointness — no value is both `isEventTarget` and `isAbortSignal`
 *      (proto === EventTarget.prototype vs. AbortSignal.prototype are disjoint).
 *   C. Cross-realm verdict symmetry — an UNTAMPERED shape reads identically local vs
 *      foreign. The deliberately-asymmetric tampered-tag graft (admitted locally by
 *      the identity fast-path, rejected cross-realm by the structural arm) is excluded
 *      by design and asserted AS asymmetric, pinning the #063 residual boundary.
 *   D. Falsy floor — every predicate rejects every falsy input.
 *   E. Determinism — repeated calls on the same instance agree (no hidden state).
 *   F. Witnesses — the lattices do not collapse: an EventTargetLike-not-EventTarget, an
 *      AbortSignalLike-not-AbortSignal, and a real AbortSignal that is NOT an
 *      EventTarget (the disjointness witness) all exist.
 *
 * Throw-safety (that no predicate throws on hostile input) is the axis-5 concern —
 * see `throw-safety.test.js`; this suite assumes it and asserts relationships.
 */

import { describe, it, expect } from 'vitest';

import {
  isEventTargetLike,
  isEventTarget,
  isAbortSignalLike,
  isAbortSignal,
} from '#index';

import {
  directEventTarget,
  eventTargetSubclassInstance,
  userlandEventTarget,
  emptyObject,
  abortControllerSignal,
  abortSignalTimeout,
  abortSignalAny,
  userlandAbortSignal,
  eventTargetMissingMethod,
  abortController,
  abortSurfaceOnly,
  abortedNonBoolean,
  foreignEventTarget,
  foreignEventTargetSubclass,
  foreignAbortSignal,
  foreignPlainObject,
  tagSpoofedEventTarget,
  tagSpoofedAbortSignal,
  whenBearingUserlandEventTarget,
  localTagSpoofedEventTargetGraft,
  localTagThrowingEventTargetGraft,
  foreignTagSpoofedEventTargetGraft,
  throwingProtoTrapProxy,
  valueOverThrowingProtoDescTrap,
  abortedGetterThrowUserland,
  throwingOwnKeysProto,
} from './__config.js';

// The full value corpus — clean shapes across both lattices, spoof/graft boundaries,
// hostile traps, and foreign-realm synthetics. The relationship laws must hold across
// ALL of them.
/** @type {Array<[string, () => unknown]>} */
const corpus = [
  ['directEventTarget', directEventTarget],
  ['eventTargetSubclassInstance', eventTargetSubclassInstance],
  ['userlandEventTarget', userlandEventTarget],
  ['emptyObject', emptyObject],
  ['abortControllerSignal', abortControllerSignal],
  ['abortSignalTimeout', abortSignalTimeout],
  ['abortSignalAny', abortSignalAny],
  ['userlandAbortSignal', userlandAbortSignal],
  ['eventTargetMissingMethod', eventTargetMissingMethod],
  ['abortController', abortController],
  ['abortSurfaceOnly', abortSurfaceOnly],
  ['abortedNonBoolean', abortedNonBoolean],
  ['foreignEventTarget', foreignEventTarget],
  ['foreignEventTargetSubclass', foreignEventTargetSubclass],
  ['foreignAbortSignal', foreignAbortSignal],
  ['foreignPlainObject', foreignPlainObject],
  ['tagSpoofedEventTarget', tagSpoofedEventTarget],
  ['tagSpoofedAbortSignal', tagSpoofedAbortSignal],
  ['whenBearingUserlandEventTarget', whenBearingUserlandEventTarget],
  ['localTagSpoofedEventTargetGraft', localTagSpoofedEventTargetGraft],
  ['localTagThrowingEventTargetGraft', localTagThrowingEventTargetGraft],
  ['foreignTagSpoofedEventTargetGraft', foreignTagSpoofedEventTargetGraft],
  ['throwingProtoTrapProxy', throwingProtoTrapProxy],
  ['valueOverThrowingProtoDescTrap', valueOverThrowingProtoDescTrap],
  ['abortedGetterThrowUserland', abortedGetterThrowUserland],
  ['throwingOwnKeysProto', throwingOwnKeysProto],
];

const falsyFloor = [null, undefined, 0, '', false, NaN, 0n];

describe('evented — structural invariants (A: refinement + lattice-extends)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: isEventTarget⇒isEventTargetLike, isAbortSignal⇒isAbortSignalLike⇒isEventTargetLike`, () => {
      const v = make();
      const etLike = isEventTargetLike(v);
      const asLike = isAbortSignalLike(v);
      expect(!isEventTarget(v) || etLike, `${label}: EventTarget but not Like`).toBe(
        true,
      );
      expect(!isAbortSignal(v) || asLike, `${label}: AbortSignal but not Like`).toBe(
        true,
      );
      // the lattice-extends law: AbortSignalLike ⊆ EventTargetLike.
      expect(!asLike || etLike, `${label}: AbortSignalLike but not EventTargetLike`).toBe(
        true,
      );
    });
  }
});

describe('evented — structural invariants (B: strict-tier disjointness)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: !(isEventTarget && isAbortSignal)`, () => {
      const v = make();
      // distinct prototype identities — a value cannot be a direct EventTarget AND a
      // direct AbortSignal at once.
      expect(isEventTarget(v) && isAbortSignal(v)).toBe(false);
    });
  }
});

describe('evented — structural invariants (C: cross-realm verdict symmetry)', () => {
  // UNTAMPERED shapes read identically across realms — no verdict depends on realm
  // membership alone.
  /** @type {Array<[string, () => unknown, () => unknown]>} */
  const untamperedPairs = [
    ['direct EventTarget', directEventTarget, foreignEventTarget],
    ['EventTarget subclass', eventTargetSubclassInstance, foreignEventTargetSubclass],
    ['direct AbortSignal', abortControllerSignal, foreignAbortSignal],
  ];

  for (const [label, local, foreign] of untamperedPairs) {
    it(`${label}: [isEventTargetLike, isEventTarget, isAbortSignalLike, isAbortSignal] is realm-independent`, () => {
      /** @param {unknown} v - the value to score across the four predicates */
      const quad = (v) => [
        isEventTargetLike(v),
        isEventTarget(v),
        isAbortSignalLike(v),
        isAbortSignal(v),
      ];
      expect(quad(foreign()), `${label}: foreign ≠ local`).toEqual(quad(local()));
    });
  }

  it('the tampered cosmetic-tag graft is DELIBERATELY asymmetric (the #063 residual)', () => {
    // the boundary of law C: a spoofed-tag graft onto the real EventTarget.prototype is
    // admitted by the tag-blind LOCAL identity fast-path (it genuinely has
    // eventTargetPrototype) but rejected by the tag-reading cross-realm structural arm —
    // same shape, opposite isEventTarget verdict by realm, by design.
    expect(isEventTarget(localTagSpoofedEventTargetGraft()), 'local admit').toBe(true);
    expect(isEventTarget(foreignTagSpoofedEventTargetGraft()), 'foreign reject').toBe(
      false,
    );
    // the throwing-tag local graft admits too (the local arm never reads the tag).
    expect(isEventTarget(localTagThrowingEventTargetGraft()), 'local throwing-tag').toBe(
      true,
    );
  });
});

describe('evented — structural invariants (D: falsy floor)', () => {
  for (const value of falsyFloor) {
    it(`${String(value)}: all four predicates reject`, () => {
      expect(isEventTargetLike(value), 'isEventTargetLike').toBe(false);
      expect(isEventTarget(value), 'isEventTarget').toBe(false);
      expect(isAbortSignalLike(value), 'isAbortSignalLike').toBe(false);
      expect(isAbortSignal(value), 'isAbortSignal').toBe(false);
    });
  }
});

describe('evented — structural invariants (E: determinism)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: repeated calls on the same instance agree`, () => {
      const v = make();
      expect(isEventTargetLike(v)).toBe(isEventTargetLike(v));
      expect(isEventTarget(v)).toBe(isEventTarget(v));
      expect(isAbortSignalLike(v)).toBe(isAbortSignalLike(v));
      expect(isAbortSignal(v)).toBe(isAbortSignal(v));
    });
  }
});

describe('evented — structural invariants (F: the lattices do not collapse)', () => {
  it('an EventTargetLike that is NOT a direct EventTarget exists (userland 3-method object)', () => {
    const v = userlandEventTarget();
    expect(isEventTargetLike(v)).toBe(true);
    expect(isEventTarget(v)).toBe(false);
  });

  it('an AbortSignalLike that is NOT a direct AbortSignal exists (userland abort-signal)', () => {
    const v = userlandAbortSignal();
    expect(isAbortSignalLike(v)).toBe(true);
    expect(isAbortSignal(v)).toBe(false);
  });

  it('a real AbortSignal is NOT a direct EventTarget (strict-tier disjointness witness)', () => {
    const v = abortControllerSignal();
    expect(isAbortSignal(v)).toBe(true);
    expect(isEventTarget(v)).toBe(false);
    // …yet it IS EventTargetLike (an AbortSignal is an EventTarget instance).
    expect(isEventTargetLike(v)).toBe(true);
  });
});

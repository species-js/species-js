// @ts-check

/**
 * @module test/evented/cross-realm
 *
 * Axis 2 — cross-realm. A foreign-realm `EventTarget` / `AbortSignal` has the
 * SAME structural contract as a local one but a DIFFERENT intrinsic identity:
 * local `instanceof EventTargetConstructor` misses, so the strict predicates'
 * cross-realm structural-equivalence arm (`isAlienRealm{X}` — the tag +
 * constructor-name signal gate plus the own-descriptor prototype contract) must
 * carry the verdict. Foreign non-EventTargets stay rejected by the same
 * realm-independent contract.
 *
 * `EventTarget` / `AbortController` are Node globals, not ECMAScript intrinsics,
 * so the vm realm cannot produce a REAL foreign one — the fixtures are foreign
 * SYNTHETICS (see `__config.js`): genuinely foreign values (foreign class /
 * prototype) that mimic the structural contract, which is precisely what the
 * cross-realm arm is designed to admit.
 *
 * Mirrors the "Cross-realm (axis 2)" expectations in `docs/spec/EVENTED.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import {
  isEventTargetLike,
  isEventTarget,
  isAbortSignalLike,
  isAbortSignal,
  isAlienRealmEventTarget,
  isAlienRealmAbortSignal,
  getInertPrototypeOf,
} from '@/index.js';

import {
  foreignEventTarget,
  foreignEventTargetSubclass,
  foreignAbortSignal,
  foreignPlainObject,
} from './__config.js';

describe('evented — cross-realm (axis 2)', () => {
  it('isEventTargetLike/A5 + isEventTarget/A2: a foreign EventTarget → Like true, strict true', () => {
    const foreign = foreignEventTarget();
    expect(isEventTargetLike(foreign), 'isEventTargetLike').toBe(true);
    expect(isEventTarget(foreign), 'isEventTarget').toBe(true);
    // not an AbortSignal
    expect(isAbortSignalLike(foreign), 'isAbortSignalLike').toBe(false);
    expect(isAbortSignal(foreign), 'isAbortSignal').toBe(false);
  });

  it('isAbortSignalLike/A4 + isAbortSignal/A3: a foreign AbortSignal → Like true, strict true', () => {
    const foreign = foreignAbortSignal();
    // an AbortSignal is an EventTarget, so EventTargetLike holds; but it is a
    // direct AbortSignal, not a direct EventTarget (constructor-name gate).
    expect(isEventTargetLike(foreign), 'isEventTargetLike').toBe(true);
    expect(isEventTarget(foreign), 'isEventTarget').toBe(false);
    expect(isAbortSignalLike(foreign), 'isAbortSignalLike').toBe(true);
    expect(isAbortSignal(foreign), 'isAbortSignal').toBe(true);
  });

  it('a foreign EventTarget SUBCLASS → EventTargetLike true, isEventTarget false (name gate)', () => {
    const foreign = foreignEventTargetSubclass();
    expect(isEventTargetLike(foreign), 'isEventTargetLike').toBe(true);
    expect(isEventTarget(foreign), 'isEventTarget').toBe(false);
  });

  it('the strict cross-realm arms carry the foreign verdict (local instanceof missed)', () => {
    const foreignET = foreignEventTarget();
    expect(
      isAlienRealmEventTarget(
        foreignET,
        /** @type {object} */ (getInertPrototypeOf(foreignET)),
      ),
      'isAlienRealmEventTarget',
    ).toBe(true);

    const foreignAS = foreignAbortSignal();
    expect(
      isAlienRealmAbortSignal(
        foreignAS,
        /** @type {object} */ (getInertPrototypeOf(foreignAS)),
      ),
      'isAlienRealmAbortSignal',
    ).toBe(true);
  });

  it('a foreign non-EventTarget (plain object) → all four false', () => {
    const foreign = foreignPlainObject();
    expect(isEventTargetLike(foreign), 'isEventTargetLike').toBe(false);
    expect(isEventTarget(foreign), 'isEventTarget').toBe(false);
    expect(isAbortSignalLike(foreign), 'isAbortSignalLike').toBe(false);
    expect(isAbortSignal(foreign), 'isAbortSignal').toBe(false);
  });
});

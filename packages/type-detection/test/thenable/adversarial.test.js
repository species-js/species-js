// @ts-check

/**
 * @module test/thenable/adversarial
 *
 * Axis 3 — adversarial / spoof-resistance. The spec's "Spoof-resistance
 * expectation" plus the documented refuses-to-claim boundaries: accessor
 * traps (inspect-without-invoke), the `Symbol.toStringTag` spoof, and the
 * structurally-unsealable `Object.create(Promise.prototype)` graft, which is
 * a *known admission* (decision #052), asserted here so the boundary is
 * pinned rather than mistaken for a defect.
 *
 * Mirrors the "Spoof-resistance expectation (axis 3)" notes in
 * `docs/spec/THENABLE.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import { isThenable, isPromiseLike, isPromise } from '@/index.js';

import {
  accessorThen,
  accessorFinally,
  fullContract,
  tagSpoofedPromise,
  promisePrototypeGraft,
} from './__config.js';

describe('thenable — accessor traps (inspect-without-invoke)', () => {
  it('isThenable/R2: accessor `then` → false (getter not invoked)', () => {
    expect(isThenable(accessorThen())).toBe(false);
  });

  it('isPromiseLike/R3: accessor `finally` → false', () => {
    expect(isPromiseLike(accessorFinally())).toBe(false);
  });
});

describe('isPromise — spoof-resistance', () => {
  it('R3: Symbol.toStringTag = "Promise" over a plain contract → false (ctor-walk reaches Object)', () => {
    expect(isPromise(tagSpoofedPromise())).toBe(false);
  });

  it('a tag-spoof is still admitted by the by-contract predicates (no identity claim)', () => {
    // isPromiseLike makes no identity claim — the three methods are present.
    expect(isPromiseLike(tagSpoofedPromise())).toBe(true);
  });
});

describe('isPromise — structurally-unsealable graft (decision #052)', () => {
  it('B2: Object.create(Promise.prototype) → true (KNOWN admission — shape, not liveness)', () => {
    // Documented hole: passes instanceof + proto-identity; carries no
    // [[PromiseState]]. Promise exposes no inert internal-slot accessor, so
    // structural detection cannot reject it. Asserted to pin the boundary.
    expect(isPromise(promisePrototypeGraft())).toBe(true);
  });

  it('isThenable/B3: the same graft is admitted (inherits `then`)', () => {
    expect(isThenable(promisePrototypeGraft())).toBe(true);
  });

  it('the graft satisfies the full contract too (isPromiseLike admits)', () => {
    expect(isPromiseLike(promisePrototypeGraft())).toBe(true);
    // Sanity: the contract methods are the inherited Promise.prototype ones.
    expect(isPromiseLike(fullContract())).toBe(true);
  });
});

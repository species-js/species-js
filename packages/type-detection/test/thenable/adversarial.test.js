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
  nullProtoTagSpoofedPromise,
  promisePrototypeGraft,
  throwingGetterThen,
  throwingDescTrapProxy,
  throwingProtoTrapProxy,
  throwingTagGetterWithContract,
  taggedPromiseOverThrowingProtoTrap,
  ownConstructorNamedPromise,
} from './__config.js';

describe('thenable — accessor traps (inspect-without-invoke)', () => {
  it('isThenable/R2: accessor `then` → false (getter not invoked)', () => {
    expect(isThenable(accessorThen())).toBe(false);
  });

  it('isPromiseLike/R3: accessor `finally` → false', () => {
    expect(isPromiseLike(accessorFinally())).toBe(false);
  });
});

describe('thenable — throw-safety on hostile inputs (hardened hasInertMethod, #029-class)', () => {
  // A throw here would surface as a test error, so asserting the boolean IS the
  // throw-safety proof: pre-hardening these propagated the exception.
  it('isThenable/B4: accessor `then` whose getter THROWS → false (inert read never invokes)', () => {
    expect(isThenable(throwingGetterThen())).toBe(false);
  });

  it('isThenable/B5: Proxy with a throwing getOwnPropertyDescriptor trap → false, not thrown', () => {
    expect(isThenable(throwingDescTrapProxy())).toBe(false);
    expect(isPromiseLike(throwingDescTrapProxy())).toBe(false);
  });

  it('B6: Proxy with a throwing getPrototypeOf trap → false on all three, not thrown', () => {
    // The instanceof arm (isCurrentRealmPromiseInstance) is now throw-safe too.
    const make = throwingProtoTrapProxy;
    expect(isThenable(make())).toBe(false);
    expect(isPromiseLike(make())).toBe(false);
    expect(isPromise(make())).toBe(false);
  });

  it('B7: throwing Symbol.toStringTag getter + full contract → isPromise false, not thrown', () => {
    // getTypeSignature is throw-safe; isThenable/isPromiseLike see the real
    // methods (they never read the tag), isPromise's tag read yields undefined.
    const make = throwingTagGetterWithContract;
    expect(isThenable(make())).toBe(true);
    expect(isPromiseLike(make())).toBe(true);
    expect(isPromise(make())).toBe(false);
  });

  it('isPromise/B5: own tag+contract over a throwing-getOwnPropertyDescriptor-trap prototype → false, not thrown (#056)', () => {
    // The cross-realm arm's constructor-walk pivots into the hostile proto.
    // getDefinedConstructor now routes through getInertDescriptor → undefined →
    // hasPromiseIdentitySignal false → isPromise answers false instead of throwing.
    // isThenable/isPromiseLike already stayed safe (own then/contract found first).
    const make = taggedPromiseOverThrowingProtoTrap;
    expect(isThenable(make())).toBe(true);
    expect(isPromiseLike(make())).toBe(true);
    expect(isPromise(make())).toBe(false);
  });
});

describe('isPromise — own-constructor tamper resistance (#047)', () => {
  it('R6: tagged `Promise` carrying an own `constructor` named Promise → false', () => {
    // getDefinedConstructor walks the prototype-chain and ignores the own
    // `constructor` data property, so the walk reaches Object, not Promise.
    expect(isPromise(ownConstructorNamedPromise())).toBe(false);
  });
});

describe('isPromise — spoof-resistance', () => {
  it('R3: Symbol.toStringTag = "Promise" over a plain contract → false (ctor-walk reaches Object)', () => {
    expect(isPromise(tagSpoofedPromise())).toBe(false);
  });

  it('R7: null-prototype tag-spoof with full own contract → false, not thrown (ctor-walk hits null)', () => {
    // Distinct path from R3/R6: the constructor-walk pivots to the value's
    // [[Prototype]] — here null — so the name resolves to undefined, not Object.
    expect(isPromise(nullProtoTagSpoofedPromise())).toBe(false);
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

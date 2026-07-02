// @ts-check

/**
 * @module test/thenable/adversarial
 *
 * Axis 3 — adversarial / spoof-resistance (the non-throwing surface). The spec's
 * "Spoof-resistance expectation" plus the testable boundaries: accessor traps
 * (inspect-without-invoke), the `Symbol.toStringTag` / own-`constructor` spoofs,
 * and the structurally-unsealable `Object.create(Promise.prototype)` graft — a
 * known admission (decision #052), asserted here so the boundary is pinned rather
 * than mistaken for a defect.
 *
 * Throw-safety (hostile Proxies, throwing accessors / tag getters) is the
 * universal invariant and lives in its own matrix — see `throw-safety.test.js`.
 *
 * Mirrors the "Spoof-resistance expectation (axis 3)" notes + the testable `B`
 * boundaries in `docs/spec/THENABLE.spec.md`.
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
  promiseMethodShadowGraft,
  promiseConstructorShadowGraft,
  promiseGraftWithOrthogonalState,
  taggedPromiseGraftLocal,
  taggedPromiseGraftForeign,
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

describe('isPromise — own-constructor tamper resistance (#047)', () => {
  it('isPromise/R6: tagged `Promise` carrying an own `constructor` named Promise → false', () => {
    // getDefinedConstructor walks the prototype-chain and ignores the own
    // `constructor` data property, so the walk reaches Object, not Promise.
    expect(isPromise(ownConstructorNamedPromise())).toBe(false);
  });
});

describe('isPromise — spoof-resistance', () => {
  it('isPromise/R3: Symbol.toStringTag = "Promise" over a plain contract → false (ctor-walk reaches Object)', () => {
    expect(isPromise(tagSpoofedPromise())).toBe(false);
  });

  it('isPromise/R7: null-prototype tag-spoof with full own contract → false (ctor-walk hits null)', () => {
    // Distinct path from R3/R6: the constructor-walk pivots to the value's
    // [[Prototype]] — here null — so the name resolves to undefined, not Object.
    expect(isPromise(nullProtoTagSpoofedPromise())).toBe(false);
  });

  it('a tag-spoof is still admitted by the by-contract predicates (no identity claim)', () => {
    // isPromiseLike makes no identity claim — the three methods are present.
    expect(isPromiseLike(tagSpoofedPromise())).toBe(true);
  });
});

describe('isPromise — prototype graft: #052 bare admit + #063 own-shadow demotion', () => {
  it('isPromise/B2: Object.create(Promise.prototype) → true (KNOWN admission — shape, not liveness, #052)', () => {
    // Documented boundary: passes instanceof + proto-identity; carries no
    // [[PromiseState]]. Promise exposes no inert internal-slot accessor, so
    // structural detection cannot reject the BARE graft — and the #063
    // own-shadow gate leaves it standing (it owns nothing to shadow).
    expect(isPromise(promisePrototypeGraft())).toBe(true);
  });

  it('isThenable/B3: the same bare graft is admitted (inherits `then`)', () => {
    expect(isThenable(promisePrototypeGraft())).toBe(true);
  });

  it('the bare graft satisfies the full contract too (isPromiseLike admits)', () => {
    expect(isPromiseLike(promisePrototypeGraft())).toBe(true);
    // Sanity: the contract methods are the inherited Promise.prototype ones.
    expect(isPromiseLike(fullContract())).toBe(true);
  });

  it('isPromise/R8: an own-`then`-shadow graft → Like-not-is (strict false, Like + Thenable true)', () => {
    // #063 own-shadow: the OWN `then` overrides the inherited contract — an
    // instance-level subclass layer, so isPromise demotes it. Asserted on the
    // SAME instance so the demotion's LANDING (still Like/Thenable) is pinned.
    const graft = promiseMethodShadowGraft();
    expect(isPromise(graft), 'isPromise').toBe(false);
    expect(isPromiseLike(graft), 'isPromiseLike').toBe(true);
    expect(isThenable(graft), 'isThenable').toBe(true);
  });

  it('isPromise/R9: an own-`constructor`-shadow graft → Like-not-is (strict false, Like + Thenable true)', () => {
    const graft = promiseConstructorShadowGraft();
    expect(isPromise(graft), 'isPromise').toBe(false);
    expect(isPromiseLike(graft), 'isPromiseLike').toBe(true);
    expect(isThenable(graft), 'isThenable').toBe(true);
  });

  it('orthogonal own state does NOT demote (the gate is a scalpel over reserved names, not a blanket)', () => {
    // an own `id` is not a reserved contract member → isPromise stays true.
    expect(isPromise(promiseGraftWithOrthogonalState())).toBe(true);
  });
});

describe('isPromise — realm asymmetry on tampered inputs (deliberate; the #063 residual)', () => {
  // #063 reconciled the BEHAVIORAL half of the asymmetry (own-level method /
  // constructor shadowing, rejected in both realms — R8/R9 above). The COSMETIC
  // half stays: a spoofed `Symbol.toStringTag` is symbol-keyed (invisible to the
  // string-keyed own-shadow gate) and never read by the local identity arm.
  it('isPromise/A4: a LOCAL graft with a spoofed tag → true (identity arm is tag-blind)', () => {
    expect(isPromise(taggedPromiseGraftLocal())).toBe(true);
  });

  it('the FOREIGN-realm counterpart (same spoofed tag) → false (structural arm reads the tag)', () => {
    expect(isPromise(taggedPromiseGraftForeign())).toBe(false);
  });
});

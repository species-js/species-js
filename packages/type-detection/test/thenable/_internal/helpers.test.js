// @ts-check

/**
 * @module test/thenable/_internal/helpers
 *
 * Axis 4 — helper-unit (white-box). The exported `@internal` helpers tested in
 * isolation:
 *   - `doesImplementPromiseContract` — the structural three-method contract read
 *     over the value's prototype-chain (the lenient `isPromiseLike` fallback).
 *   - `hasPromiseIdentitySignal` — the two string-shape markers: the value's
 *     `[[Class]]` tag and the constructor name threaded in by the caller.
 *   - `doesImplementPromisePrototypeContract` — the prototype-side member-surface
 *     marker (own `then`/`catch`/`finally` callable data properties).
 *   - `isPromisePrototypeEquivalent` — the four-marker cross-realm prototype
 *     anchor (isClass + tag + round-trip identity + member surface).
 *   - `isAlienRealmPromise` — the exported cross-realm seam itself: the identity
 *     signal gate AND the prototype anchor, resolving the constructor once.
 *   - `isCurrentRealmPromiseInstance` — the local-realm instanceof arm.
 *   - `doesNotShadowPromiseContract` — the #063 own-surface integrity gate.
 * Testing these directly catches contract violations the orchestrator-only
 * suites would mask, and exercises the cross-realm path on local values.
 *
 * Mirrors the "Helper specification (axis 4)" section in
 * `docs/spec/THENABLE.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import {
  doesImplementPromiseContract,
  doesNotShadowPromiseContract,
  hasPromiseIdentitySignal,
  doesImplementPromisePrototypeContract,
  isPromisePrototypeEquivalent,
  isAlienRealmPromise,
  isCurrentRealmPromiseInstance,
  getInertPrototypeOf,
  getDefinedConstructor,
  objectCreate,
} from '#index';

import {
  fullContract,
  ownThenable,
  thenCatchOnly,
  accessorFinally,
  localPromise,
  promiseSubclassInstance,
  foreignPromise,
  foreignPromiseSubclassInstance,
  tagSpoofedPromise,
  throwingTagGetterWithContract,
  localPromisePrototype,
  foreignPromisePrototype,
  promisePrototypeGraft,
  promiseMethodShadowGraft,
  promiseConstructorShadowGraft,
  promiseGraftWithOrthogonalState,
  ownKeysTrapOverPromiseProto,
} from '../__config.js';

describe('[Internal] doesImplementPromiseContract', () => {
  it('dMPC/A1: Promise.resolve() → true (three methods inherited)', () => {
    expect(doesImplementPromiseContract(Promise.resolve())).toBe(true);
  });

  it('dMPC/A2: own then/catch/finally data props → true', () => {
    expect(doesImplementPromiseContract(fullContract())).toBe(true);
  });

  it('dMPC/A3: inherited then/catch/finally → true', () => {
    expect(doesImplementPromiseContract(objectCreate(fullContract()))).toBe(true);
  });

  it('dMPC/R1: only `then` → false (short-circuits at missing catch)', () => {
    expect(doesImplementPromiseContract(ownThenable())).toBe(false);
  });

  it('dMPC/R2: then + catch (missing finally) → false', () => {
    expect(doesImplementPromiseContract(thenCatchOnly())).toBe(false);
  });

  it('dMPC/R3: accessor `finally` → false', () => {
    expect(doesImplementPromiseContract(accessorFinally())).toBe(false);
  });

  it('dMPC/R4: nullish → false (via hasInertMethod nullish-safety, no own !!value guard)', () => {
    expect(doesImplementPromiseContract(null)).toBe(false);
    expect(doesImplementPromiseContract(undefined)).toBe(false);
  });
});

describe('[Internal] hasPromiseIdentitySignal', () => {
  it('hPIS/A1: (Promise.resolve(), "Promise") → true (both markers: tag + threaded name)', () => {
    expect(hasPromiseIdentitySignal(Promise.resolve(), 'Promise')).toBe(true);
  });

  it('hPIS/A2: (Promise.prototype, "Promise") → true (prototype object carries the Promise tag)', () => {
    expect(hasPromiseIdentitySignal(localPromisePrototype(), 'Promise')).toBe(true);
  });

  it('hPIS/R1: (Promise.resolve(), "Object") → false (the threaded name marker is load-bearing)', () => {
    expect(hasPromiseIdentitySignal(Promise.resolve(), 'Object')).toBe(false);
  });

  it('hPIS/R2: ({ [toStringTag]: "Promise" }, "Object") → false (tag-spoof defeated by the real name)', () => {
    expect(hasPromiseIdentitySignal({ [Symbol.toStringTag]: 'Promise' }, 'Object')).toBe(
      false,
    );
  });

  it('hPIS/R3: (full-contract PromiseLike, "Promise") → false (tag [object Object] mismatch)', () => {
    expect(hasPromiseIdentitySignal(fullContract(), 'Promise')).toBe(false);
  });

  it('hPIS/R4: (Promise.resolve(), undefined) → false (no reachable name threaded in)', () => {
    expect(hasPromiseIdentitySignal(Promise.resolve(), undefined)).toBe(false);
  });

  it('hPIS/B1: (throwing toStringTag getter, "Promise") → false, not thrown (throw-safe tag read)', () => {
    expect(hasPromiseIdentitySignal(throwingTagGetterWithContract(), 'Promise')).toBe(
      false,
    );
  });
});

describe('[Internal] doesImplementPromisePrototypeContract (prototype-side member surface)', () => {
  it('dIPPC/A1: local Promise.prototype → true (own then/catch/finally callable)', () => {
    expect(doesImplementPromisePrototypeContract(localPromisePrototype())).toBe(true);
  });

  it('dIPPC/A2: foreign Promise.prototype → true (own descriptors read realm-independently)', () => {
    expect(doesImplementPromisePrototypeContract(foreignPromisePrototype())).toBe(true);
  });

  it('dIPPC/R1: Object.prototype → false (carries no own then/catch/finally)', () => {
    expect(doesImplementPromisePrototypeContract(Object.prototype)).toBe(false);
  });

  it('dIPPC/R2: own then/catch but no finally → false (own, not inherited)', () => {
    // fed a plain value as a "prototype": own then + catch callable, finally absent.
    expect(doesImplementPromisePrototypeContract(thenCatchOnly())).toBe(false);
  });

  it('dIPPC/R3: an accessor `then` → false (reads `.value`, so a getter yields undefined)', () => {
    expect(
      doesImplementPromisePrototypeContract({
        get then() {
          return () => undefined;
        },
        catch: () => undefined,
        finally: () => undefined,
      }),
    ).toBe(false);
  });

  it('dIPPC/B1: a hostile `ownKeys` trap that throws → false, not thrown (fail-closed)', () => {
    // the try/catch boundary: `getOwnPropertyDescriptors` triggers the throwing
    // `ownKeys` trap, which is absorbed to `false` rather than propagating.
    expect(doesImplementPromisePrototypeContract(ownKeysTrapOverPromiseProto())).toBe(
      false,
    );
  });
});

describe('[Internal] isPromisePrototypeEquivalent (fed the prototype + its resolved constructor)', () => {
  // mirrors the production thread: resolve the constructor ONCE from the prototype
  // (`assumePrototype`), exactly as `isAlienRealmPromise` hands it in.
  /**
   * @param {unknown} proto - the candidate `Promise.prototype` to validate
   */
  const iPPE = (proto) => {
    const p = /** @type {object} */ (proto);
    return isPromisePrototypeEquivalent(
      p,
      getDefinedConstructor(p, { assumePrototype: true }),
    );
  };

  it('iPPE/A1: local Promise.prototype → true (all four markers hold)', () => {
    expect(iPPE(localPromisePrototype())).toBe(true);
  });

  it('iPPE/A2: foreign Promise.prototype → true (realm-independent)', () => {
    expect(iPPE(foreignPromisePrototype())).toBe(true);
  });

  it('iPPE/R1: (Promise.prototype, undefined) → false (marker 1: isClass(undefined) fails)', () => {
    expect(isPromisePrototypeEquivalent(localPromisePrototype(), undefined)).toBe(false);
  });

  it('iPPE/R2: Object.prototype → false (marker 2: tag is `[object Object]`)', () => {
    expect(iPPE(Object.prototype)).toBe(false);
  });

  it('iPPE/R3: (Promise.prototype, Array) → false (marker 3: round-trip prototype mismatch)', () => {
    // a MISMATCHED pair the production thread never produces, but which isolates
    // the round-trip marker: `Array.prototype !== Promise.prototype`.
    expect(
      isPromisePrototypeEquivalent(
        localPromisePrototype(),
        getDefinedConstructor(Array.prototype, { assumePrototype: true }),
      ),
    ).toBe(false);
  });
});

describe('[Internal] isAlienRealmPromise (the exported cross-realm seam)', () => {
  // `iARP` feeds the seam a value + its already-resolved `[[Prototype]]`, exactly
  // as `isPromise` hands it on the cross-realm branch; the seam resolves the
  // constructor + name ONCE (#059) and threads them into both composed helpers.
  /**
   * @param {unknown} value - the candidate whose cross-realm Promise verdict to carry
   */
  const iARP = (value) =>
    isAlienRealmPromise(
      /** @type {object} */ (value),
      /** @type {object} */ (getInertPrototypeOf(value)),
    );

  it('iARP/A1: a foreign direct Promise → true (the cross-realm arm; mirrors isPromise/A3)', () => {
    expect(iARP(foreignPromise())).toBe(true);
  });

  it('iARP/A2: a local direct Promise → true (the seam admits it on structure; isPromise fast-paths it)', () => {
    expect(iARP(localPromise())).toBe(true);
  });

  it('iARP/R1: a foreign Promise subclass → false (signal gate: ctor-name `MyPromise`; mirrors isPromise/R2)', () => {
    expect(iARP(foreignPromiseSubclassInstance())).toBe(false);
  });

  it('iARP/R2: a tag-spoof over a plain contract → false (signal gate: resolved ctor-name `Object`; mirrors isPromise/R3)', () => {
    expect(iARP(tagSpoofedPromise())).toBe(false);
  });

  it('iARP/R3: a PromiseLike non-Promise → false (signal gate: tag `[object Object]`; mirrors isPromise/R4)', () => {
    expect(iARP(fullContract())).toBe(false);
  });
});

describe('[Internal] isCurrentRealmPromiseInstance', () => {
  it('iCRPI/A1: Promise.resolve() → true', () => {
    expect(isCurrentRealmPromiseInstance(Promise.resolve())).toBe(true);
  });

  it('iCRPI/A2: Promise subclass instance → true (subclass-admitting)', () => {
    expect(isCurrentRealmPromiseInstance(promiseSubclassInstance())).toBe(true);
  });

  it('iCRPI/R1: foreign-realm Promise → false (instanceof local capture)', () => {
    expect(isCurrentRealmPromiseInstance(foreignPromise())).toBe(false);
  });

  it('iCRPI/R2: { then() {} } → false (not a Promise instance)', () => {
    expect(isCurrentRealmPromiseInstance(ownThenable())).toBe(false);
  });
});

describe('[Internal] doesNotShadowPromiseContract (#063 own-surface integrity gate)', () => {
  it('dNSP/A1: a genuine Promise → true (owns NONE of its contract — state in internal slots)', () => {
    expect(doesNotShadowPromiseContract(Promise.resolve())).toBe(true);
    expect(doesNotShadowPromiseContract(promiseSubclassInstance())).toBe(true);
  });

  it('dNSP/A2: the bare `Object.create(Promise.prototype)` graft → true (owns nothing to shadow)', () => {
    // why isPromise/B2 stays admitted under #063: the gate finds no own reserved
    // key. Liveness is a separate, unsealable concern (#052).
    expect(doesNotShadowPromiseContract(promisePrototypeGraft())).toBe(true);
  });

  it('dNSP/A3: a graft carrying orthogonal own state (`id`) → true (scalpel, not blanket)', () => {
    expect(doesNotShadowPromiseContract(promiseGraftWithOrthogonalState())).toBe(true);
  });

  it('dNSP/R1: an own `then` shadowing the inherited contract method → false', () => {
    expect(doesNotShadowPromiseContract(promiseMethodShadowGraft())).toBe(false);
  });

  it('dNSP/R2: an own `constructor` shadowing the back-reference → false', () => {
    expect(doesNotShadowPromiseContract(promiseConstructorShadowGraft())).toBe(false);
  });

  it('dNSP/B1: a hostile `ownKeys` trap that throws → false, not thrown (fail-closed)', () => {
    // helper-level throw-safety boundary: the own-key enumeration is wrapped in
    // try/catch, so a throwing trap collapses to `false` (cannot confirm a clean
    // surface → treat as shadowed) rather than propagating.
    expect(doesNotShadowPromiseContract(ownKeysTrapOverPromiseProto())).toBe(false);
  });
});

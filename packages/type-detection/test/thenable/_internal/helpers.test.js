// @ts-check

/**
 * @module test/thenable/_internal/helpers
 *
 * Axis 4 — helper-unit (white-box). The five exported `@internal` helpers
 * tested in isolation:
 *   - `doesImplementPromiseContract` — the structural three-method contract.
 *   - `hasPromiseIdentitySignal` — the two string-shape markers (tag + name),
 *     with the `assumePrototype` option for prototype-object inputs.
 *   - `isStructuralPromisePrototypeEquivalent` — prototype-side validation with
 *     reciprocal own-constructor identity.
 *   - `isStructuralPromiseEquivalent` — `isPromise`'s full cross-realm arm.
 *   - `isCurrentRealmPromiseInstance` — the local-realm instanceof arm.
 * Testing these directly catches contract violations the orchestrator-only
 * suites would mask, and exercises the cross-realm path on local values.
 *
 * CONTAMINATION NOTE (decision #054): the constructor registries are
 * value-keyed, so a prototype object resolved both with and without
 * `assumePrototype` would poison its own cache entry. Every prototype input
 * here is resolved under ONE option-setting (see the `__config.js` axis-4
 * inputs); the single no-option demonstration (hPIS/R1) uses an isolated fresh
 * realm so it cannot reach any `assumePrototype` vector.
 *
 * Mirrors the "Helper specification (axis 4)" section in
 * `docs/spec/THENABLE.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import {
  doesImplementPromiseContract,
  hasPromiseIdentitySignal,
  isStructuralPromisePrototypeEquivalent,
  isStructuralPromiseEquivalent,
  isCurrentRealmPromiseInstance,
  objectCreate,
} from '@/index.js';

import {
  fullContract,
  ownThenable,
  thenCatchOnly,
  accessorFinally,
  promiseSubclassInstance,
  foreignPromise,
  foreignPromiseSubclassInstance,
  tagSpoofedPromise,
  throwingTagGetterWithContract,
  localPromisePrototype,
  foreignPromisePrototype,
  foreignPromiseConstructor,
  isolatedForeignPromisePrototype,
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
  it('hPIS/A1: Promise.resolve() (no options) → true (tag + walked ctor-name)', () => {
    expect(hasPromiseIdentitySignal(Promise.resolve())).toBe(true);
  });

  it('hPIS/A2: Promise.prototype with { assumePrototype: true } → true (own ctor-name)', () => {
    expect(
      hasPromiseIdentitySignal(localPromisePrototype(), { assumePrototype: true }),
    ).toBe(true);
  });

  it('hPIS/R1: a (fresh-realm) Promise.prototype WITHOUT options → false (name walks up to Object)', () => {
    // Why the prototype legs MUST pass assumePrototype — the bug #054 fixed. An
    // ISOLATED realm, so this no-option resolution cannot poison an assume vector.
    expect(hasPromiseIdentitySignal(isolatedForeignPromisePrototype())).toBe(false);
  });

  it('hPIS/R2: { [toStringTag]: "Promise" } with no real constructor → false (name reaches Object)', () => {
    expect(hasPromiseIdentitySignal({ [Symbol.toStringTag]: 'Promise' })).toBe(false);
  });

  it('hPIS/R3: full-contract PromiseLike (tag [object Object]) → false (tag mismatch)', () => {
    expect(hasPromiseIdentitySignal(fullContract())).toBe(false);
  });

  it('hPIS/B1: throwing Symbol.toStringTag getter → false, not thrown (throw-safe tag read)', () => {
    expect(hasPromiseIdentitySignal(throwingTagGetterWithContract())).toBe(false);
  });
});

describe('[Internal] isStructuralPromisePrototypeEquivalent', () => {
  it('iSPPE/A1: (Promise.prototype, Promise) → true', () => {
    expect(isStructuralPromisePrototypeEquivalent(localPromisePrototype(), Promise)).toBe(
      true,
    );
  });

  it('iSPPE/A2: (foreign Promise.prototype, foreign Promise ctor) → true (realm-independent)', () => {
    expect(
      isStructuralPromisePrototypeEquivalent(
        foreignPromisePrototype(),
        foreignPromiseConstructor(),
      ),
    ).toBe(true);
  });

  it('iSPPE/R1: (Promise.prototype, undefined) → false (falsy constructor short-circuits)', () => {
    expect(
      isStructuralPromisePrototypeEquivalent(localPromisePrototype(), undefined),
    ).toBe(false);
  });

  it('iSPPE/R2: (Object.prototype, Object) → false (tag is [object Object])', () => {
    expect(isStructuralPromisePrototypeEquivalent(Object.prototype, Object)).toBe(false);
  });

  it('iSPPE/R3: (Promise.prototype, Array) → false (reciprocal own-constructor identity fails)', () => {
    expect(isStructuralPromisePrototypeEquivalent(localPromisePrototype(), Array)).toBe(
      false,
    );
  });
});

describe('[Internal] isStructuralPromiseEquivalent', () => {
  it('iSPE/A1: foreign direct Promise → true (cross-realm arm; mirrors isPromise/A3)', () => {
    expect(isStructuralPromiseEquivalent(foreignPromise())).toBe(true);
  });

  it('iSPE/R1: foreign Promise subclass → false (instance ctor-name "MyPromise"; mirrors isPromise/R2)', () => {
    expect(isStructuralPromiseEquivalent(foreignPromiseSubclassInstance())).toBe(false);
  });

  it('iSPE/R2: tag-spoof over a plain contract → false (instance ctor-walk reaches Object; mirrors isPromise/R3)', () => {
    expect(isStructuralPromiseEquivalent(tagSpoofedPromise())).toBe(false);
  });

  it('iSPE/R3: PromiseLike non-Promise → false (tag [object Object]; mirrors isPromise/R4)', () => {
    expect(isStructuralPromiseEquivalent(fullContract())).toBe(false);
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

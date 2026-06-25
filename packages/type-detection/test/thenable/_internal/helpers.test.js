// @ts-check

/**
 * @module test/thenable/_internal/helpers
 *
 * Axis 4 — helper-unit (white-box). The five exported `@internal` helpers
 * tested in isolation:
 *   - `doesImplementPromiseContract` — the structural three-method contract.
 *   - `hasPromiseIdentitySignal` — the two string-shape markers: the value's
 *     `[[Class]]` tag and the constructor name threaded in by the caller.
 *   - `isStructuralPromisePrototypeEquivalent` — prototype-side validation with
 *     reciprocal own-constructor identity.
 *   - `isStructuralPromiseEquivalent` — `isPromise`'s full cross-realm arm.
 *   - `isCurrentRealmPromiseInstance` — the local-realm instanceof arm.
 * Testing these directly catches contract violations the orchestrator-only
 * suites would mask, and exercises the cross-realm path on local values.
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

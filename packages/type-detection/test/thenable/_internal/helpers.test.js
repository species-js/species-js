// @ts-check

/**
 * @module test/thenable/_internal/helpers
 *
 * Axis 4 — helper-unit (white-box). The exported `@internal` helpers tested
 * in isolation: `doesMatchPromiseContract` (the structural three-method
 * contract, no instanceof fast-path) and `isCurrentRealmPromiseInstance`
 * (the local-realm instanceof arm). Testing these directly catches contract
 * violations the orchestrator-only suites would mask, and exercises the
 * cross-realm code path on local values (the helpers are realm-independent).
 *
 * Mirrors the "Helper specification (axis 4)" section in
 * `docs/spec/THENABLE.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import {
  doesMatchPromiseContract,
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
} from '../__config.js';

describe('[Internal] doesMatchPromiseContract', () => {
  it('dMPC/A1: Promise.resolve() → true (three methods inherited)', () => {
    expect(doesMatchPromiseContract(Promise.resolve())).toBe(true);
  });

  it('dMPC/A2: own then/catch/finally data props → true', () => {
    expect(doesMatchPromiseContract(fullContract())).toBe(true);
  });

  it('dMPC/A3: inherited then/catch/finally → true', () => {
    expect(doesMatchPromiseContract(objectCreate(fullContract()))).toBe(true);
  });

  it('dMPC/R1: only `then` → false (short-circuits at missing catch)', () => {
    expect(doesMatchPromiseContract(ownThenable())).toBe(false);
  });

  it('dMPC/R2: then + catch (missing finally) → false', () => {
    expect(doesMatchPromiseContract(thenCatchOnly())).toBe(false);
  });

  it('dMPC/R3: accessor `finally` → false', () => {
    expect(doesMatchPromiseContract(accessorFinally())).toBe(false);
  });

  it('dMPC/R4: nullish → false (via hasInertMethod nullish-safety, no own !!value guard)', () => {
    expect(doesMatchPromiseContract(null)).toBe(false);
    expect(doesMatchPromiseContract(undefined)).toBe(false);
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

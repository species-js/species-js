// @ts-check

/**
 * @module test/object/_internal/helpers
 *
 * Axis 4 — helper-unit (white-box). The exported `@internal` helpers that form
 * the cross-realm structural arm of `isPlainObject` / `isDictionaryObject`,
 * tested in isolation on LOCAL values (they carry no local-realm fast-path, so
 * they run the realm-independent logic directly — no `vm` realm needed):
 *   - `hasPlainObjectIdentitySignal` — the two cheap plain-object string-shape
 *     markers (tag `'[object Object]'` + constructor-name `'Object'`).
 *   - `hasDictionaryObjectIdentitySignal` — the dictionary counterpart (tag
 *     `'[object Object]'` + NO reachable constructor).
 *   - `isObjectPrototypeEquivalent` — the six-marker prototype contract
 *     (isClass + tag + own `name` + round-trip `prototype` + chain-depth null +
 *     own member surface). Takes the already-resolved `[[Prototype]]` (#059), so
 *     each input is threaded through `getInertPrototypeOf`.
 *   - `doesImplementObjectPrototypeContract` — marker 6 in isolation: the
 *     prototype's own member surface against the host-calibrated canonical set.
 *
 * Together these cover the unexported `isAlienRealmPlainObject` seam, which is
 * exactly `hasPlainObjectIdentitySignal(value) && isObjectPrototypeEquivalent(proto)`.
 *
 * Mirrors the "Helper specification (axis 4)" section in `docs/spec/OBJECT.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import {
  hasPlainObjectIdentitySignal,
  hasDictionaryObjectIdentitySignal,
  isObjectPrototypeEquivalent,
  doesImplementObjectPrototypeContract,
  getInertPrototypeOf,
} from '@/index.js';

import {
  emptyObject,
  newObject,
  objectCreateObjectProto,
  array,
  dateInstance,
  nullProtoObject,
  nullProtoWithConstructorKey,
  classInstance,
  tagSpoofedNullProto,
  tamperedConstructorPlainObject,
  classExtendsNullRenamedObject,
  fullMemberSurfaceProto,
  wrongShapeMemberSurfaceProto,
  throwingOwnKeysProto,
  valueWithSurgicalHostileConstructor,
  valueWithBlanketHostileConstructor,
} from '../__config.js';

describe('[Internal] hasPlainObjectIdentitySignal', () => {
  it('hPOIS/A1: plain objects → true (tag + ctor-name both `Object`)', () => {
    expect(hasPlainObjectIdentitySignal(emptyObject())).toBe(true);
    expect(hasPlainObjectIdentitySignal(newObject())).toBe(true);
    expect(hasPlainObjectIdentitySignal(objectCreateObjectProto())).toBe(true);
  });

  it('hPOIS/R1: container instances → false (tag mismatch)', () => {
    expect(hasPlainObjectIdentitySignal(array())).toBe(false);
    expect(hasPlainObjectIdentitySignal(dateInstance())).toBe(false);
  });

  it('hPOIS/R2: Object.create(null) → false (ctor-name resolves to undefined)', () => {
    expect(hasPlainObjectIdentitySignal(nullProtoObject())).toBe(false);
  });

  it('hPOIS/R3: a class instance → false (ctor-name `Foo`)', () => {
    expect(hasPlainObjectIdentitySignal(classInstance())).toBe(false);
  });
});

describe('[Internal] hasDictionaryObjectIdentitySignal', () => {
  it('hDOIS/A1: Object.create(null) → true (tag `Object` + no reachable ctor)', () => {
    expect(hasDictionaryObjectIdentitySignal(nullProtoObject())).toBe(true);
  });

  it('hDOIS/A2: null-proto hashmap with own `constructor` key → true (own ctor ignored, #047)', () => {
    expect(hasDictionaryObjectIdentitySignal(nullProtoWithConstructorKey())).toBe(true);
  });

  it('hDOIS/R1: a plain object → false (ctor resolves to `Object`, not undefined)', () => {
    expect(hasDictionaryObjectIdentitySignal(emptyObject())).toBe(false);
  });

  it('hDOIS/R2: tag-spoofed null-proto object → false (tag is not `[object Object]`)', () => {
    expect(hasDictionaryObjectIdentitySignal(tagSpoofedNullProto())).toBe(false);
  });
});

describe('[Internal] isObjectPrototypeEquivalent (fed the resolved prototype)', () => {
  it('iOPE/A1: a real plain object`s prototype → true (all six markers hold)', () => {
    expect(isObjectPrototypeEquivalent(getInertPrototypeOf(emptyObject()))).toBe(true);
    expect(isObjectPrototypeEquivalent(getInertPrototypeOf(newObject()))).toBe(true);
  });

  it('iOPE/R1: an array`s prototype → false (marker 2: tag is `[object Array]`)', () => {
    expect(isObjectPrototypeEquivalent(getInertPrototypeOf(array()))).toBe(false);
  });

  it('iOPE/R2: a class instance`s prototype → false (marker 3: constructor name is `Foo`)', () => {
    expect(isObjectPrototypeEquivalent(getInertPrototypeOf(classInstance()))).toBe(false);
  });

  it('iOPE/R3: a null prototype → false (marker 1: no constructor → isClass fails)', () => {
    expect(isObjectPrototypeEquivalent(getInertPrototypeOf(nullProtoObject()))).toBe(
      false,
    );
  });

  it('iOPE/R4: tampered `constructor` over a hand-crafted prototype → false (round-trip marker 4)', () => {
    expect(
      isObjectPrototypeEquivalent(getInertPrototypeOf(tamperedConstructorPlainObject())),
    ).toBe(false);
  });

  it('iOPE/R5: hollow `class extends null` renamed `Object` → false (member-surface marker 6)', () => {
    // satisfies markers 1–5; only the member-surface marker rejects it.
    expect(
      isObjectPrototypeEquivalent(getInertPrototypeOf(classExtendsNullRenamedObject())),
    ).toBe(false);
  });

  it('iOPE/B1: a prototype carrying a hostile (throwing-descriptor) `constructor` → false, not thrown', () => {
    // helper-level throw-safety boundary (parallel to dIOPC/B1, thenable hPIS/B1).
    // Invoked directly — no signal gate in front — so the helper must itself be
    // throw-safe at marker 1 (isClass) + markers 3/4 (getVerifiedOwnName /
    // getInertDescriptor). The SURGICAL ctor throws only on `prototype` (reaching
    // markers 3/4); the BLANKET ctor throws on every key (caught at isClass).
    // A propagated throw surfaces here as a test error, not a `false`.
    expect(
      isObjectPrototypeEquivalent(
        getInertPrototypeOf(valueWithSurgicalHostileConstructor()),
      ),
      'surgical',
    ).toBe(false);
    expect(
      isObjectPrototypeEquivalent(
        getInertPrototypeOf(valueWithBlanketHostileConstructor()),
      ),
      'blanket',
    ).toBe(false);
  });
});

describe('[Internal] doesImplementObjectPrototypeContract (marker 6 in isolation)', () => {
  it('dIOPC/A1: a real Object.prototype → true (full canonical member surface)', () => {
    expect(doesImplementObjectPrototypeContract(getInertPrototypeOf(emptyObject()))).toBe(
      true,
    );
  });

  it('dIOPC/A2: a hand-built full-member-surface prototype → true (documented residual)', () => {
    expect(doesImplementObjectPrototypeContract(fullMemberSurfaceProto())).toBe(true);
  });

  it('dIOPC/A3: augmentation-tolerant — extra own properties do not break it', () => {
    const augmented = fullMemberSurfaceProto();
    Object.defineProperty(augmented, 'extra', { value: 1, enumerable: true });
    Object.defineProperty(augmented, 'flatten', { value: () => undefined });
    expect(doesImplementObjectPrototypeContract(augmented)).toBe(true);
  });

  it('dIOPC/R1: a hollow `class extends null` prototype → false (carries only `constructor`)', () => {
    expect(
      doesImplementObjectPrototypeContract(
        getInertPrototypeOf(classExtendsNullRenamedObject()),
      ),
    ).toBe(false);
  });

  it('dIOPC/R2: Array.prototype → false (own, not inherited: it inherits the Object methods)', () => {
    expect(doesImplementObjectPrototypeContract(getInertPrototypeOf(array()))).toBe(
      false,
    );
  });

  it('dIOPC/R3: canonical names with the WRONG descriptor shape → false (accessor / enumerable / non-callable)', () => {
    // right names, wrong shape — each violates the non-enumerable-callable-data
    // discipline of isValidObjectPrototypeDescriptor; the residual fixture (A2)
    // passes because its shapes are right, this one must be rejected.
    expect(doesImplementObjectPrototypeContract(wrongShapeMemberSurfaceProto())).toBe(
      false,
    );
  });

  it('dIOPC/B1: a hostile Proxy prototype whose `ownKeys` trap throws → false, not thrown', () => {
    // the only path that exercises marker 6`s try/catch: the predicate path fails
    // marker 1 before reaching marker 6, so the throw-safety is reachable only here.
    expect(doesImplementObjectPrototypeContract(throwingOwnKeysProto())).toBe(false);
  });
});

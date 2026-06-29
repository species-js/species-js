// @ts-check

/**
 * @module test/object/adversarial
 *
 * Axis 3 — adversarial / spoof-resistance (the NON-throwing surface). The
 * structural predicates close four spoof surfaces, all described in the
 * "Spoof (axis 3)" notes of `docs/spec/OBJECT.spec.md`:
 *   - a prototype-less object lying about its `[[Class]]` via an own
 *     `Symbol.toStringTag` (isDictionaryObject's tag cross-validator).
 *   - a plain object whose `constructor` is tampered to point at the global
 *     `Object` while its real prototype is hand-crafted (isPlainObject's
 *     round-trip identity marker).
 *   - a constructor whose `name` is exposed only through an accessor
 *     (the descriptor-via-`.value` discipline).
 *   - a hollow `class extends null` renamed to `'Object'`, whose prototype
 *     passes all five identity markers but carries none of `Object.prototype`'s
 *     methods (the member-surface marker, decision-aligned with the six-marker
 *     contract).
 *
 * Throw-safety (hostile Proxies: prototype-trap, descriptor-trap, surgical /
 * blanket constructor-trap, throwing tag getter) is the universal invariant and
 * lives in its own matrix — see `throw-safety.test.js`. The member-surface
 * `ownKeys`-trap and the standalone `isObjectPrototypeEquivalent` throw-safety
 * are HELPER-level boundaries (`dIOPC/B1`, `iOPE/B1`) — see
 * `_internal/helpers.test.js`.
 *
 * Mirrors the "Spoof (axis 3)" expectations in `docs/spec/OBJECT.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import { isDictionaryObject, isPlainObject, isPlainOrDictionaryObject } from '@/index.js';

import {
  tagSpoofedNullProto,
  tamperedConstructorPlainObject,
  accessorNameConstructorPrototype,
  classExtendsNullRenamedObject,
  localTagSpoofedPlainObject,
  foreignTagSpoofedPlainObject,
} from './__config.js';

describe('object — adversarial / spoof-resistance (axis 3)', () => {
  it('isDictionaryObject/R4: null-proto object with a spoofed `Symbol.toStringTag` → false', () => {
    // prototype-less (would pass getPrototypeOf === null) but the tag
    // cross-validator getTypeSignature === '[object Object]' rejects the lie.
    expect(isDictionaryObject(tagSpoofedNullProto())).toBe(false);
    expect(isPlainOrDictionaryObject(tagSpoofedNullProto())).toBe(false);
  });

  it('isPlainObject: tampered `constructor` pointing at global Object → false (round-trip marker)', () => {
    // signal markers pass (tag + walked ctor-name `Object`), but the round-trip
    // identity marker fails: Object.prototype !== the value's hand-crafted prototype.
    expect(isPlainObject(tamperedConstructorPlainObject())).toBe(false);
    expect(isPlainOrDictionaryObject(tamperedConstructorPlainObject())).toBe(false);
  });

  it('isPlainObject: constructor `name` exposed only via accessor → false (descriptor-via-.value)', () => {
    // the accessor `name` yields `undefined` from `?.value`, so the constructor
    // name never resolves to the string `'Object'` — the lie is never read.
    expect(isPlainObject(accessorNameConstructorPrototype())).toBe(false);
  });

  it('isPlainObject/R6 + isPlainOrDictionaryObject/R3: hollow `class extends null` renamed `Object` → false (member-surface marker 6)', () => {
    // its prototype passes the five identity markers (null-rooted, tag, ctor-name
    // `Object`, round-trip) but carries only `constructor` — no `Object.prototype`
    // methods. The member-surface marker is the only one that rejects it.
    expect(isPlainObject(classExtendsNullRenamedObject())).toBe(false);
    expect(isPlainOrDictionaryObject(classExtendsNullRenamedObject())).toBe(false);
  });
});

describe('object — realm asymmetry on a (non-throwing) tag-spoofed plain object', () => {
  // DELIBERATE, documented property (spec → isPlainObject "Realm asymmetry on
  // tampered inputs"): the SAME tampering yields `true` locally / `false`
  // cross-realm, because the local fast-path is identity-based (tag-blind) while
  // the cross-realm arm is structural (tag-sensitive). The non-throwing
  // counterpart of the throw-safety matrix's local/alien tag-getter pair — pinned
  // here so the asymmetry is fixed against regression, not just the throwing case.
  it('isPlainObject/A3: a LOCAL plain object with a spoofed `Symbol.toStringTag` → true (identity fast-path, tag never read)', () => {
    expect(isPlainObject(localTagSpoofedPlainObject())).toBe(true);
    expect(isPlainOrDictionaryObject(localTagSpoofedPlainObject())).toBe(true);
  });

  it('the FOREIGN-realm counterpart → false (structural arm reads the spoofed tag and rejects)', () => {
    expect(isPlainObject(foreignTagSpoofedPlainObject())).toBe(false);
    expect(isPlainOrDictionaryObject(foreignTagSpoofedPlainObject())).toBe(false);
  });
});

// @ts-check

/**
 * @module test/object/adversarial
 *
 * Axis 3 — adversarial / spoof-resistance. The structural predicates close
 * four spoof surfaces, all described in the "Spoof (axis 3)" notes of
 * `docs/spec/OBJECT.spec.md`:
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
 * Plus the throw-safety surface, attacked from every trap angle: a type-guard
 * must answer a boolean on every input, including hostile Proxies. Every
 * descriptor/prototype read in the cross-realm path routes through a throw-safe
 * reader — `getInertPrototypeOf` (prototype), `getInertDescriptor` /
 * `getVerifiedOwnName` (constructor name + round-trip), and `isClass` is
 * throw-safe at its own read (root-fixed in `@/function`, decision-aligned with
 * #056/#057). The SURGICAL hostile-constructor vector is the angle that matters:
 * it passes the inexpensive identity-signal gate and so drives the hostile value
 * into the contract-walk, a blanket-throwing Proxy never reaches.
 *
 * Mirrors the "Spoof (axis 3)" expectations in `docs/spec/OBJECT.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import {
  isObject,
  isDictionaryObject,
  isPlainObject,
  isPlainOrDictionaryObject,
  isObjectPrototypeEquivalent,
  getInertPrototypeOf,
} from '@/index.js';

import {
  tagSpoofedNullProto,
  tamperedConstructorPlainObject,
  accessorNameConstructorPrototype,
  classExtendsNullRenamedObject,
  throwingProtoTrapProxy,
  valueOverThrowingProtoDescTrap,
  valueWithSurgicalHostileConstructor,
  valueWithBlanketHostileConstructor,
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

  it('isPlainObject/B1 + isDictionaryObject/B1 + isPlainOrDictionaryObject/B1: hostile getPrototypeOf trap → false, not thrown (throw-safe prototype read)', () => {
    // every prototype read routes through getInertPrototypeOf, so the trap's
    // throw collapses to `undefined` and each predicate answers `false`.
    expect(isObject(throwingProtoTrapProxy()), 'isObject').toBe(true); // typeof, no proto read
    expect(isPlainObject(throwingProtoTrapProxy()), 'isPlainObject').toBe(false);
    expect(isDictionaryObject(throwingProtoTrapProxy()), 'isDictionaryObject').toBe(
      false,
    );
    expect(
      isPlainOrDictionaryObject(throwingProtoTrapProxy()),
      'isPlainOrDictionaryObject',
    ).toBe(false);
  });

  it('isPlainObject/B3: value over a hostile getOwnPropertyDescriptor [[Prototype]] trap → false, not thrown', () => {
    // the constructor-walk pivots into the hostile proto; getDefinedConstructor
    // routes its reads through getInertDescriptor (#056) → undefined → false.
    expect(isPlainObject(valueOverThrowingProtoDescTrap()), 'isPlainObject').toBe(false);
    expect(
      isDictionaryObject(valueOverThrowingProtoDescTrap()),
      'isDictionaryObject',
    ).toBe(false);
    expect(
      isPlainOrDictionaryObject(valueOverThrowingProtoDescTrap()),
      'isPlainOrDictionaryObject',
    ).toBe(false);
  });

  it('isPlainObject/B2: SURGICAL hostile constructor (throws only on `prototype`) → false, not thrown', () => {
    // passes the identity-signal gate (tag + ctor-name `Object`) and so reaches
    // the contract walk — isClass(constructor) + markers 3/4 — where the trap
    // would throw on raw reads. The throw-safe isClass / getInertDescriptor /
    // getVerifiedOwnName collapse it to `false`. This is the angle the blanket
    // Proxy (below) never reaches.
    expect(isPlainObject(valueWithSurgicalHostileConstructor()), 'isPlainObject').toBe(
      false,
    );
    expect(
      isPlainOrDictionaryObject(valueWithSurgicalHostileConstructor()),
      'isPlainOrDictionaryObject',
    ).toBe(false);
  });

  it('blanket hostile constructor (throws on every key) → false, not thrown', () => {
    // caught earlier by the throw-safe identity-signal gate (name read → undefined).
    expect(isPlainObject(valueWithBlanketHostileConstructor()), 'isPlainObject').toBe(
      false,
    );
  });

  it('helper isObjectPrototypeEquivalent called standalone on hostile ctor → false, not thrown', () => {
    // axis-4: the @internal helper, invoked directly (no signal gate in front),
    // must itself be throw-safe at isClass + markers 3/4. It takes the
    // already-resolved [[Prototype]] (#059) — the hand-crafted proto carrying the
    // hostile constructor.
    expect(
      isObjectPrototypeEquivalent(
        getInertPrototypeOf(valueWithSurgicalHostileConstructor()),
      ),
    ).toBe(false);
    expect(
      isObjectPrototypeEquivalent(
        getInertPrototypeOf(valueWithBlanketHostileConstructor()),
      ),
    ).toBe(false);
  });
});

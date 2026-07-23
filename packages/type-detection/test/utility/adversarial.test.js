// @ts-check

/**
 * @module test/utility/adversarial.test
 *
 * Axis-3 (non-throwing) attack angles for the `utility` module. Each test is
 * built to BREAK a plausible-but-wrong implementation — own-vs-inherited,
 * data-vs-accessor, chain-shadowing, inspect-without-invoke, tamper-resistance,
 * cross-validator divergence, and the raw/throw-safe pairing — not to re-assert
 * the happy-path matrix. The throwing surface (hostile Proxy traps as the sole
 * input) lives in `throw-safety.test.js`.
 */

import { describe, it, expect } from 'vitest';

import {
  hasOwnPrototype,
  hasOwnWritablePrototype,
  hasOwnNonWritablePrototype,
  hasInertMethod,
  hasInertGetter,
  isValidPropertyKey,
  isValidWeakKey,
  getDefinedConstructor,
  getTypeSignature,
  getTaggedType,
  resolveType,
  getNextAvailablePropertyDescriptor,
  getNextAvailableSafeDescriptor,
} from '#index';

import {
  inheritedPrototype,
  accessorPrototype,
  proxyLiesHasPrototype,
  inheritedOnlyMethod,
  ownNonCallableShadowsMethod,
  throwingGetterAtThen,
  registeredSymbolValue,
  tamperedConstructorReal,
  tamperedConstructorString,
  accessorConstructor,
  pascalCtorSpoofedTag,
  nullProtoTagSpoof,
  throwingDescTrapProxy,
} from './__config.js';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  hasOwn* — own-vs-inherited and data-vs-accessor
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('hasOwn* attack angles', () => {
  it('rejects an INHERITED `prototype` — own-only, an `in`-based impl would pass it', () => {
    const value = inheritedPrototype();
    expect('prototype' in /** @type {object} */ (value)).toBe(true); // reachable via the chain
    expect(hasOwnPrototype(value)).toBe(false); // but NOT an own descriptor
  });

  it('an own ACCESSOR `prototype` is present but neither writable-variant', () => {
    const value = accessorPrototype();
    expect(hasOwnPrototype(value)).toBe(true); // the descriptor exists
    expect(hasOwnWritablePrototype(value)).toBe(false); // accessor has no `writable`
    expect(hasOwnNonWritablePrototype(value)).toBe(false); // `?.writable` is undefined, not false
  });

  it('is not fooled by a lying `has` trap — it reads the descriptor, not `in`', () => {
    const value = proxyLiesHasPrototype();
    expect('prototype' in /** @type {object} */ (value)).toBe(true); // the trap lies `true`
    expect(hasOwnPrototype(value)).toBe(false); // the own descriptor is still absent
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  hasInert* — chain-walk, shadowing, inspect-without-invoke
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('hasInert* attack angles', () => {
  it('finds an INHERITED `then` via the chain (the own/chain contrast)', () => {
    expect(hasInertMethod(inheritedOnlyMethod(), 'then')).toBe(true);
  });

  it('an own non-callable `then` SHADOWS the inherited callable → false', () => {
    // kills a "reaches a callable anywhere on the chain" implementation.
    expect(hasInertMethod(ownNonCallableShadowsMethod(), 'then')).toBe(false);
  });

  it('a THROWING getter is inspected, never invoked: hIM false, hIG true, no throw', () => {
    const value = throwingGetterAtThen();
    expect(() => hasInertMethod(value, 'then')).not.toThrow();
    expect(hasInertMethod(value, 'then')).toBe(false); // an accessor carries no data `value`
    expect(hasInertGetter(value, 'then')).toBe(true); // the getter fn is present, never called
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Validators — cross-validator divergence
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('cross-validator divergence', () => {
  it('a registered symbol is a valid property key but NOT a valid weak key', () => {
    const sym = registeredSymbolValue();
    expect(isValidPropertyKey(sym)).toBe(true); // every symbol keys
    expect(isValidWeakKey(sym)).toBe(false); // the engine refuses to hold it weakly
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Constructor / type readers — tamper resistance
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('constructor / type-reader tamper resistance', () => {
  it('a tampered own `constructor` cannot redirect the structural walk', () => {
    expect(getDefinedConstructor(tamperedConstructorReal())).toBe(Object); // `{ constructor: Array }`
    expect(getDefinedConstructor(tamperedConstructorString())).toBe(Object); // `{ constructor: 'tampered' }`
    expect(resolveType(tamperedConstructorReal())).toBe('Object');
  });

  it('an ACCESSOR `constructor` is bypassed by the pivot and never invoked', () => {
    expect(getDefinedConstructor(accessorConstructor())).toBe(Object);
  });

  it('rT/A6: resolveType prefers the PascalCase ctor name over a spoofed tag', () => {
    const value = pascalCtorSpoofedTag();
    expect(resolveType(value)).toBe('Foo'); // ctor name wins (axis 1)
    expect(getTaggedType(value)).toBe('Bar'); // same value — the tag reader honors the spoof
  });

  it('a null-proto tag-spoof: tag honored, no constructor, resolves to the tag', () => {
    const value = nullProtoTagSpoof();
    expect(getTypeSignature(value)).toBe('[object Custom]'); // structural read honors the own tag
    expect(getDefinedConstructor(value)).toBe(undefined); // null proto → no reachable ctor
    expect(resolveType(value)).toBe('Custom'); // falls through to the tag
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Raw vs throw-safe descriptor walk — the pairing is REAL
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('raw / throw-safe descriptor pairing', () => {
  it('the RAW walk propagates a hostile trap; the Safe twin absorbs it', () => {
    const hostile = throwingDescTrapProxy();
    expect(() => getNextAvailablePropertyDescriptor(hostile, 'x')).toThrow(); // raw propagates
    expect(getNextAvailableSafeDescriptor(hostile, 'x')).toBe(undefined); // safe → undefined
  });
});

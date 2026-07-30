// @ts-check

/**
 * @module test/utility/__config
 *
 * Test configuration for the `utility` module. Unlike the domain modules,
 * `utility` is not a single superset lattice — its 22 public functions have
 * heterogeneous signatures (single-value predicates, `(type, key)` chain
 * probes, value→output readers, and the intrinsic-pair capture). So the config
 * is a set of FOCUSED matrices and input→output tables, each covering one
 * cluster, rather than one global candidate×predicate matrix (the
 * config-driven-is-a-tool principle).
 *
 * This file grows in increments, each mirroring a section of
 * `docs/spec/UTILITY.spec.md`:
 *   1. boolean-predicate clusters — `hasOwn*` (matrix), `hasInert*` (matrix),
 *      `isValidPropertyKey` / `isValidWeakKey` (accept/reject sets).  ✓ landed
 *   2. reader input→output tables — `getSafePrototypeOf`, `getTypeSignature`,
 *      `getTaggedType`, `getDefinedConstructor(Name)`, `resolveType`,
 *      `getVerifiedOwnName`, the own-key readers, the descriptor walks.  ✓ landed
 *   3. throw-safety matrix — `hostile-mechanism × throw-safe function` (oracle: the
 *      `@@throw-safe` set), heterogeneous per-cell sentinels.  ✓ landed
 *   4. `@internal` helper inputs — `getValidatedStandardConstructorAndPrototypeTuple`,
 *      `isValueOfBoundSet`.  ← next (drives `_internal/helpers.test.js`)
 *
 * `spec.test.js` drives the axis-1 matrices and the axis-2 realm-agnosticism
 * vectors; `throw-safety.test.js` drives the axis-3 matrix; `adversarial.test.js`
 * imports the named attack-angle factories it needs.
 */

import { objectCreate } from '#index';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Shared candidate factories (fresh value per call)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// callable species — the own-`prototype` discriminators (ES3 vs class) and the
// generator/arrow/bound edges.
export const es3Function = () =>
  function f() {
    return undefined;
  };
export const generatorFunction = () =>
  function* () {
    yield undefined;
  };
export const arrowFunction = () => () => undefined;
export const boundFunction = () =>
  function () {
    return undefined;
  }.bind(null);
export const customClass = () =>
  class C {
    m() {
      return true;
    }
  };
export const builtinClassArray = () => Array;
export const plainObject = () => ({});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  `hasOwn*` prototype-predicate matrix (axis 1)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Each row scores a candidate against all three own-`prototype` predicates.
// The trio is NOT exhaustive: a value with no own `prototype` is `false` for
// both `hasOwnWritablePrototype` and `hasOwnNonWritablePrototype` (the
// `?.writable` is `undefined`, matching neither `true` nor `false`).

/**
 * @typedef {object} HasOwnRow
 * @property {string} description - human-readable candidate description
 * @property {() => unknown} make - fresh-value factory
 * @property {{ hasOwnPrototype: boolean, hasOwnWritablePrototype: boolean, hasOwnNonWritablePrototype: boolean }} expected - expected outcome per predicate
 * @property {string[]} vectors - spec vector IDs this row covers
 */

/** @type {Record<string, HasOwnRow>} */
export const hasOwnMatrix = {
  es3Function: {
    description: 'an ES3 `function f() {}` (own writable `prototype`)',
    make: es3Function,
    expected: {
      hasOwnPrototype: true,
      hasOwnWritablePrototype: true,
      hasOwnNonWritablePrototype: false,
    },
    vectors: ['hOP/A1', 'hOWP/A1', 'hONWP/R1'],
  },
  generatorFunction: {
    description: 'a generator `function* () {}` (own writable `prototype`)',
    make: generatorFunction,
    expected: {
      hasOwnPrototype: true,
      hasOwnWritablePrototype: true,
      hasOwnNonWritablePrototype: false,
    },
    vectors: ['hOP/A1', 'hOWP/A1', 'hONWP/R1'],
  },
  customClass: {
    description: 'a `class C {}` (own non-writable `prototype`)',
    make: customClass,
    expected: {
      hasOwnPrototype: true,
      hasOwnWritablePrototype: false,
      hasOwnNonWritablePrototype: true,
    },
    vectors: ['hOP/A1', 'hOWP/R1', 'hONWP/A1'],
  },
  builtinClassArray: {
    description: 'the built-in `Array` constructor (own non-writable `prototype`)',
    make: builtinClassArray,
    expected: {
      hasOwnPrototype: true,
      hasOwnWritablePrototype: false,
      hasOwnNonWritablePrototype: true,
    },
    vectors: ['hOP/A1', 'hOWP/R1', 'hONWP/A1'],
  },
  arrowFunction: {
    description: 'an arrow `() => {}` (no own `prototype`; inherits Function.prototype)',
    make: arrowFunction,
    expected: {
      hasOwnPrototype: false,
      hasOwnWritablePrototype: false,
      hasOwnNonWritablePrototype: false,
    },
    vectors: ['hOP/R1', 'hOWP/R2', 'hONWP/R2'],
  },
  boundFunction: {
    description: 'a bound function (`bind` strips the own `prototype` slot)',
    make: boundFunction,
    expected: {
      hasOwnPrototype: false,
      hasOwnWritablePrototype: false,
      hasOwnNonWritablePrototype: false,
    },
    vectors: ['hOP/R2', 'hOWP/R3', 'hONWP/R2'],
  },
  plainObject: {
    description: 'a plain object (no own `prototype`)',
    make: plainObject,
    expected: {
      hasOwnPrototype: false,
      hasOwnWritablePrototype: false,
      hasOwnNonWritablePrototype: false,
    },
    vectors: ['hOP/R3', 'hOWP/R3', 'hONWP/R2'],
  },
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  `hasInert*` chain-probe matrix (axis 1)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Each row is a `(type, key)` pair scored against the four inert probes. Fully
// inert: an accessor is recognized by shape (`get`/`set`), never invoked; a
// data descriptor holding `undefined` still reads as a data descriptor
// (`objectHasOwn(desc, 'value')`, not `?.value !== undefined`).

const noop = () => undefined;

/**
 * @typedef {object} HasInertRow
 * @property {string} description - human-readable candidate description
 * @property {() => unknown} make - fresh-value factory for the `type` argument
 * @property {PropertyKey} key - the property key probed
 * @property {{ hasInertMethod: boolean, hasInertGetter: boolean, hasInertSetter: boolean, hasInertValue: boolean }} expected - expected outcome per probe
 * @property {string[]} vectors - spec vector IDs this row covers
 */

/** @type {Record<string, HasInertRow>} */
export const hasInertMatrix = {
  ownCallableData: {
    description: 'an own callable data property `{ then() {} }` at `then`',
    make: () => ({ then: noop }),
    key: 'then',
    expected: {
      hasInertMethod: true,
      hasInertGetter: false,
      hasInertSetter: false,
      hasInertValue: true,
    },
    vectors: ['hIM/A2', 'hIV/A1', 'hIG/R1'],
  },
  inheritedCallableData: {
    description: 'an inherited callable `then` (a Promise instance)',
    make: () => Promise.resolve(1),
    key: 'then',
    expected: {
      hasInertMethod: true,
      hasInertGetter: false,
      hasInertSetter: false,
      hasInertValue: true,
    },
    vectors: ['hIM/A1'],
  },
  accessorGetter: {
    description: 'an accessor getter `{ get x() {} }` at `x`',
    make: () => ({
      get x() {
        return noop;
      },
    }),
    key: 'x',
    expected: {
      hasInertMethod: false,
      hasInertGetter: true,
      hasInertSetter: false,
      hasInertValue: false,
    },
    vectors: ['hIM/R3', 'hIG/A1', 'hIV/R1'],
  },
  accessorSetter: {
    description: 'an accessor setter `{ set x(v) {} }` at `x`',
    make: () => ({
      /** @param {unknown} v - ignored setter argument */
      set x(v) {
        void v;
      },
    }),
    key: 'x',
    expected: {
      hasInertMethod: false,
      hasInertGetter: false,
      hasInertSetter: true,
      hasInertValue: false,
    },
    vectors: ['hIS/A1', 'hIG/R2', 'hIS/R1'],
  },
  dataNonCallable: {
    description: 'a non-callable data property `{ then: 5 }` at `then`',
    make: () => ({ then: 5 }),
    key: 'then',
    expected: {
      hasInertMethod: false,
      hasInertGetter: false,
      hasInertSetter: false,
      hasInertValue: true,
    },
    vectors: ['hIM/R2', 'hIS/R2'],
  },
  dataUndefinedValue: {
    description: 'a data descriptor holding `undefined` `{ x: undefined }` at `x`',
    make: () => ({ x: undefined }),
    key: 'x',
    expected: {
      hasInertMethod: false,
      hasInertGetter: false,
      hasInertSetter: false,
      hasInertValue: true,
    },
    vectors: ['hIV/A2'],
  },
  inheritedData: {
    description: 'an inherited data descriptor `toString` from Object.prototype',
    make: () => ({}),
    key: 'toString',
    expected: {
      hasInertMethod: true,
      hasInertGetter: false,
      hasInertSetter: false,
      hasInertValue: true,
    },
    vectors: ['hIV/A3'],
  },
  missingKey: {
    description: 'a key absent from the whole chain',
    make: () => ({}),
    key: 'nonexistent',
    expected: {
      hasInertMethod: false,
      hasInertGetter: false,
      hasInertSetter: false,
      hasInertValue: false,
    },
    vectors: ['hIM/R1', 'hIG/R3', 'hIS/R3', 'hIV/R2'],
  },
};

// The `null` short-circuit (`type !== null`) applies uniformly to all four
// probes and is asserted once in `spec.test.js` rather than as a matrix row
// (a `null` row would score every probe `false` for the same reason).
// Covers hIM/R4, hIG/R3, hIS/R3, hIV/R3.

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Narrowing-guard accept / reject sets (axis 1)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// `isValidPropertyKey` — string | symbol | FINITE number (ADR #072). Finite
// non-integers (`1.5`) and large finite integers (`2 ** 53`) are valid string
// keys; `NaN` / `±Infinity` (error-state) and `bigint` (not a `PropertyKey`
// member) are the two distinct-reason refusals.
export const validPropertyKeys = {
  strings: ['x', '', '1.5'], // iVPK/A1
  symbols: [Symbol(), Symbol.iterator], // iVPK/A2
  finiteIntegers: [0, 42, -5, Number.MAX_SAFE_INTEGER], // iVPK/A3
  finiteNonSafe: [1.5, -2.5, 2 ** 53, Number.MAX_SAFE_INTEGER + 1], // iVPK/A4
};
export const invalidPropertyKeys = {
  nonFinite: [NaN, Infinity, -Infinity], // iVPK/R1
  nonNumberNonKey: [1n, true, {}, [], null, undefined], // iVPK/R2
};

// `isValidWeakKey` — object | function | (unregistered) symbol. The symbol arm
// is realm-capability-gated (ES2023); modern engines admit it. `Symbol.for`
// (registered) is rejected even then.
export const validWeakKeys = {
  objects: [{}, [], new Date(), objectCreate(null)], // iVWK/A1
  callables: [
    () => undefined,
    function () {
      return undefined;
    },
    class C {
      m() {
        return true;
      }
    },
  ], // iVWK/A2
  unregisteredSymbols: [Symbol(), Symbol('x')], // iVWK/A3 (capability-gated)
};
export const invalidWeakKeys = {
  registeredSymbol: [Symbol.for('x')], // iVWK/R1
  primitives: ['x', 42, true, 1n], // iVWK/R2
  nullish: [null, undefined], // iVWK/R3
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Adversarial candidates (attack angles; targeted by adversarial.test.js)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// These probe FAILURE modes, not the happy path. Each is built to break a
// plausible-but-wrong implementation of a specific function.

// OWN-vs-INHERITED (hasOwnPrototype): `prototype` reachable ONLY through the
// chain (`objectCreate(function)` inherits it), never own. `'prototype' in value`
// is `true`, but the own descriptor is absent → `hasOwnPrototype` must answer
// `false`. Kills an `in`- or `value.prototype`-based implementation.
export const inheritedPrototype = () => objectCreate(es3Function());

// OWN ACCESSOR `prototype` (hasOwnWritablePrototype / hasOwnNonWritablePrototype):
// the descriptor EXISTS (`hasOwnPrototype` true) but is an accessor, so it has no
// `writable` field — BOTH writable-variants are `false` (`?.writable` is
// `undefined`, matching neither `true` nor `false`). Kills an implementation that
// assumes an own `prototype` is always a data descriptor.
export const accessorPrototype = () =>
  Object.defineProperty({}, 'prototype', {
    get() {
      return {};
    },
    configurable: true,
  });

// LYING `has` TRAP (hasOwnPrototype): a Proxy whose `has` returns `true` for
// `prototype` while exposing no own descriptor. `hasOwnPrototype` reads
// `getOwnPropertyDescriptor`, not `in`, so the lie does not fool it → `false`.
export const proxyLiesHasPrototype = () =>
  new Proxy(
    {},
    {
      has: (_target, key) => key === 'prototype',
    },
  );

// CHAIN-WALK contrast (hasInertMethod): `then` present ONLY on the prototype.
// `hasInertMethod` walks the chain → `true` (the own-only readers would say
// `false` here — the deliberate own-vs-chain distinction).
export const inheritedOnlyMethod = () => objectCreate({ then: noop });

// OWN SHADOWS INHERITED (hasInertMethod): an own non-callable `then` over an
// inherited callable `then`. The own descriptor wins the walk → `false`. Kills a
// "reaches a callable anywhere on the chain" implementation.
export const ownNonCallableShadowsMethod = () =>
  Object.assign(objectCreate({ then: noop }), { then: 5 });

// THROWING GETTER, INSPECTED NOT INVOKED (hasInertMethod vs hasInertGetter): a
// throwing accessor getter at `then`. `hasInertMethod` is `false` (an accessor
// carries no data `value`); `hasInertGetter` is `true` — the getter is present
// and callable, inspected but never invoked, so the throw never fires.
export const throwingGetterAtThen = () => ({
  get then() {
    throw new Error('then-getter');
  },
});

// CROSS-VALIDATOR DIVERGENCE (isValidPropertyKey vs isValidWeakKey): a REGISTERED
// symbol is a valid property key (every symbol keys → `true`) but NOT a valid
// weak key (the engine refuses to hold it weakly → `false`). Same value, opposite
// verdicts — probes conflation of the two guards.
export const registeredSymbolValue = () => Symbol.for('shared');

// throwing-trap proxies (shared with throw-safety.test.js): each drives a
// throw-safe function's `try/catch` sentinel.
export const throwingDescTrapProxy = () =>
  new Proxy(
    {},
    {
      getOwnPropertyDescriptor() {
        throw new Error('desc-trap');
      },
    },
  );
export const throwingProtoTrapProxy = () =>
  new Proxy(
    {},
    {
      getPrototypeOf() {
        throw new Error('proto-trap');
      },
    },
  );
export const throwingOwnKeysTrapProxy = () =>
  new Proxy(
    {},
    {
      ownKeys() {
        throw new Error('own-keys-trap');
      },
    },
  );

// THROWING `Symbol.toStringTag` GETTER (fourth hostile surface): the tag getter
// lives on the PROTOTYPE, so `Object.prototype.toString`'s chain-walking
// `Get(@@toStringTag)` fires it (`getTypeSignature` / `getTaggedType` absorb the
// throw), while the inheritor itself carries no own keys — the own-key readers
// still report `[]`, the honest empty. The constructor walk never touches the tag,
// so `getDefinedConstructor` still resolves `Object` through the real chain.
const throwingTagProto = {
  get [Symbol.toStringTag]() {
    throw new Error('tag-getter');
  },
};
export const throwingTagInheritor = () => objectCreate(throwingTagProto);

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Type-name reader matrix (axis 1)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// The four value→type-name readers share a candidate universe, so one matrix
// scores each candidate across all four. Identity-return readers
// (`getSafePrototypeOf` → a live prototype, `getDefinedConstructor` → a live
// constructor) and the array/descriptor readers are hand-written in
// `spec.test.js` — a live reference is not a tabulable data value. The
// omitted-argument overloads (`getTypeSignature()` etc. → `undefined`) are also
// hand-written; a `make()` returning a value cannot express "no argument".

export const dateValue = () => new Date();
export const promiseValue = () => Promise.resolve(1);
export const customTagObject = () => ({ [Symbol.toStringTag]: 'Custom' });
export const nullProtoObject = () => objectCreate(null);
export const generatorInstance = () =>
  (function* () {
    yield undefined;
  })();
// A lowercase-named constructor: its instance resolves to the ctor name `foo`
// (lowercase → beats the `'Object'` tag in `resolveType`). A class expression is
// used for a clean construct signature; the readers key on the ctor NAME, which
// is identical to `new (function foo() {})()`.
export const fooInstance = () =>
  new (class foo {
    m() {
      return true;
    }
  })();
// An anonymous constructor: its instance's ctor name is the empty string.
export const anonInstance = () =>
  new (class {
    m() {
      return true;
    }
  })();

/**
 * @typedef {object} TypeReaderRow
 * @property {string} description - human-readable candidate description
 * @property {() => unknown} make - fresh-value factory
 * @property {{ getTypeSignature: string, getTaggedType: string, getDefinedConstructorName: string | undefined, resolveType: string }} expected - expected string per reader
 * @property {string[]} vectors - spec vector IDs this row covers
 */

/** @type {Record<string, TypeReaderRow>} */
export const typeReaderMatrix = {
  array: {
    description: 'an array',
    make: () => [],
    expected: {
      getTypeSignature: '[object Array]',
      getTaggedType: 'Array',
      getDefinedConstructorName: 'Array',
      resolveType: 'Array',
    },
    vectors: ['gTS/A1', 'gTT/A1', 'gDCN/A1', 'rT/A1'],
  },
  date: {
    description: 'a Date instance',
    make: dateValue,
    expected: {
      getTypeSignature: '[object Date]',
      getTaggedType: 'Date',
      getDefinedConstructorName: 'Date',
      resolveType: 'Date',
    },
    vectors: ['gTS/A1', 'gTT/A1', 'gDCN/A1', 'rT/A1'],
  },
  promise: {
    description: 'a Promise instance',
    make: promiseValue,
    expected: {
      getTypeSignature: '[object Promise]',
      getTaggedType: 'Promise',
      getDefinedConstructorName: 'Promise',
      resolveType: 'Promise',
    },
    vectors: ['gTS/A1', 'rT/A1'],
  },
  number: {
    description: 'a primitive number',
    make: () => 42,
    expected: {
      getTypeSignature: '[object Number]',
      getTaggedType: 'Number',
      getDefinedConstructorName: 'Number',
      resolveType: 'Number',
    },
    vectors: ['gTS/A4', 'gDCN/A1'],
  },
  string: {
    description: 'a primitive string',
    make: () => 'x',
    expected: {
      getTypeSignature: '[object String]',
      getTaggedType: 'String',
      getDefinedConstructorName: 'String',
      resolveType: 'String',
    },
    vectors: ['gTS/A4'],
  },
  generatorInstance: {
    description: 'a Generator instance (tag `Generator`, ctor `GeneratorFunction`)',
    make: generatorInstance,
    expected: {
      getTypeSignature: '[object Generator]',
      getTaggedType: 'Generator',
      getDefinedConstructorName: 'GeneratorFunction',
      resolveType: 'GeneratorFunction',
    },
    vectors: ['gDCN/A2'],
  },
  customTagObject: {
    description: 'a plain object with an own `Symbol.toStringTag` of `Custom`',
    make: customTagObject,
    expected: {
      getTypeSignature: '[object Custom]',
      getTaggedType: 'Custom',
      getDefinedConstructorName: 'Object',
      resolveType: 'Object',
    },
    vectors: ['gTS/A3', 'gTT/A2'],
  },
  nullProtoObject: {
    description: 'a null-prototype object (no reachable constructor)',
    make: nullProtoObject,
    expected: {
      getTypeSignature: '[object Object]',
      getTaggedType: 'Object',
      getDefinedConstructorName: undefined,
      resolveType: 'Object',
    },
    vectors: ['gDCN/R3', 'rT/A3'],
  },
  explicitNull: {
    description: 'explicit `null`',
    make: () => null,
    expected: {
      getTypeSignature: '[object Null]',
      getTaggedType: 'Null',
      getDefinedConstructorName: undefined,
      resolveType: 'Null',
    },
    vectors: ['gTS/A2', 'gTT/A1', 'rT/A2'],
  },
  explicitUndefined: {
    description: 'explicit `undefined`',
    make: () => undefined,
    expected: {
      getTypeSignature: '[object Undefined]',
      getTaggedType: 'Undefined',
      getDefinedConstructorName: undefined,
      resolveType: 'Undefined',
    },
    vectors: ['gTS/A2', 'gTT/A3', 'rT/A2'],
  },
  fooInstance: {
    description: 'an instance of a lowercase-named constructor `foo`',
    make: fooInstance,
    expected: {
      getTypeSignature: '[object Object]',
      getTaggedType: 'Object',
      getDefinedConstructorName: 'foo',
      resolveType: 'foo',
    },
    vectors: ['rT/A4'],
  },
  anonInstance: {
    description: 'an instance of an anonymous constructor (empty ctor name)',
    make: anonInstance,
    expected: {
      getTypeSignature: '[object Object]',
      getTaggedType: 'Object',
      getDefinedConstructorName: '',
      resolveType: 'Object',
    },
    vectors: ['gDCN/A3', 'rT/A5'],
  },
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  `getVerifiedOwnName` table (own `name`, string primitive only)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

export const namedFunction = () =>
  function foo() {
    return undefined;
  };
export const classBar = () =>
  class Bar {
    m() {
      return true;
    }
  };
export const anonymousFunction = () =>
  function () {
    return undefined;
  };
export const accessorNameSpoof = () => {
  const o = {};
  Object.defineProperty(o, 'name', {
    get() {
      return 'Spoofed';
    },
    configurable: true,
  });
  return o;
};
export const nonStringNameFunction = () =>
  Object.defineProperty(
    function () {
      return undefined;
    },
    'name',
    { value: 123, configurable: true },
  );

/**
 * @typedef {object} VerifiedNameRow
 * @property {string} description - human-readable candidate description
 * @property {() => unknown} make - fresh-value factory
 * @property {string | undefined} expected - expected own `name` (string primitive) or `undefined`
 * @property {string[]} vectors - spec vector IDs this row covers
 */

/** @type {Record<string, VerifiedNameRow>} */
export const verifiedOwnNameTable = {
  namedFunction: {
    description: 'a named function `function foo() {}`',
    make: namedFunction,
    expected: 'foo',
    vectors: ['gVON/A1'],
  },
  classBar: {
    description: 'a class `class Bar {}`',
    make: classBar,
    expected: 'Bar',
    vectors: ['gVON/A1'],
  },
  anonymousFunction: {
    description: 'an anonymous function (own `name` is the empty string)',
    make: anonymousFunction,
    expected: '',
    vectors: ['gVON/A2'],
  },
  accessorNameSpoof: {
    description: 'an accessor `name` returning `Spoofed` (never invoked)',
    make: accessorNameSpoof,
    expected: undefined,
    vectors: ['gVON/R1'],
  },
  nonStringNameFunction: {
    description: 'a function whose own `name` is the number `123`',
    make: nonStringNameFunction,
    expected: undefined,
    vectors: ['gVON/R2'],
  },
  noOwnName: {
    description: 'a plain object with no own `name`',
    make: plainObject,
    expected: undefined,
    vectors: ['gVON/R3'],
  },
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Reader tamper candidates (attack angles; targeted by adversarial.test.js)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// TAMPERED own `constructor` — `getDefinedConstructor`'s non-callable pivot walks
// from `[[Prototype]]`, bypassing the own `constructor` entirely → `Object`.
export const tamperedConstructorReal = () => ({ constructor: Array });
export const tamperedConstructorString = () => ({ constructor: 'tampered' });

// ACCESSOR `constructor` — bypassed by the pivot, and never invoked even if
// reached (a descriptor read) → resolves to `Object`.
export const accessorConstructor = () => {
  const o = {};
  Object.defineProperty(o, 'constructor', {
    get() {
      return Array;
    },
    configurable: true,
  });
  return o;
};

// PascalCase ctor name + SPOOFED tag — `resolveType` returns the ctor name `Foo`
// (axis 1, tag not consulted), while `getTaggedType` returns the spoofed tag
// `Bar` (a structural read honors it). Same value, two readers, two answers.
export const pascalCtorSpoofedTag = () => {
  class Foo {
    m() {
      return true;
    }
  }
  Object.defineProperty(Foo.prototype, Symbol.toStringTag, {
    value: 'Bar',
    configurable: true,
  });
  return new Foo();
};

// NULL-prototype tag-spoof — `getTypeSignature` honors the own tag
// (`[object Custom]`); `getDefinedConstructor` finds no constructor (null proto →
// `undefined`); `resolveType` falls to the tag (`Custom`).
export const nullProtoTagSpoof = () =>
  Object.assign(objectCreate(null), { [Symbol.toStringTag]: 'Custom' });

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Throw-safety matrix (axis 3) — hostile mechanism × throw-safe function
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// The universal invariant: every `@@throw-safe` PUBLIC function answers on EVERY
// hostile input and never propagates. `throw-safety.test.js` drives this matrix,
// asserting per cell BOTH no-throw AND the honest by-contract value; a
// completeness guard fails if any hostile row omits a function column, so all
// four mechanisms score all twenty functions (80 conscious cells).
//
// utility's hostile set is re-derived from its OWN read surface, which fans out
// into FOUR DISJOINT mechanisms — wider than any prior module, because utility is
// the primitive layer every read routes through:
//   - proto-trap    — `getPrototypeOf` throws (attacks `getSafePrototypeOf`, the
//                     chain-step in the descriptor walk, the non-callable
//                     constructor pivot).
//   - desc-trap     — `getOwnPropertyDescriptor` throws (attacks the `hasOwn*` /
//                     `hasInert*` / `getVerifiedOwnName` descriptor reads and the
//                     `getNextAvailableSafeDescriptor` walk — subsumes a poisoned
//                     descriptor whose own `value`/`get` getter throws during the
//                     engine's `ToPropertyDescriptor`, which raises inside the same
//                     `getOwnPropertyDescriptor` call).
//   - own-keys-trap — `ownKeys` throws (attacks ONLY the `getSafeOwnProperty*`
//                     trio — utility SPLITS the key-enumeration surface from the
//                     descriptor surface; no other function touches `ownKeys`).
//   - tag-throw     — a `Symbol.toStringTag` getter throws (attacks ONLY the tag
//                     readers `getTypeSignature` / `getTaggedType`, reached via
//                     `Object.prototype.toString`).
//
// The headline asymmetry, and the reason most cells are honest structural values
// rather than absorbed sentinels: the constructor walk reads the value's REAL
// prototype chain, so `getDefinedConstructor` still resolves `Object` under the
// desc-, own-keys-, and tag-traps (only the proto-trap severs the chain → the lone
// `undefined`), and `resolveType` returns `'Object'` in every row — under the
// tag-trap it SHORT-CIRCUITS on the constructor name and never fires the tag
// getter at all. The invariant is "never throw", not "always the null answer".

// Sentinel tokens for the non-primitive honest values (an identity `toBe` cannot
// express "some live prototype"); `throw-safety.test.js` maps each to its assertion.
export const TS_SENTINEL = Object.freeze({
  UNDEF: /** @type {const} */ ('→ undefined'),
  EMPTY: /** @type {const} */ ('→ [] (empty own-key array)'),
  PROTOTYPE: /** @type {const} */ ('→ a live prototype object'),
});

// ----- axis-5 completeness oracle: the `@@throw-safe`-marked exports -----
/**
 * The 21 `@@throw-safe`-marked exports of `src/utility/index.js` — the completeness
 * oracle (ADRs #073/#076), in source order: 20 public readers/probes PLUS the sole
 * `@internal` helper `getValidatedStandardConstructorAndPrototypeTuple` (scored in
 * `_internal/helpers.test.js`, the 20 public ones in `throw-safety.test.js`).
 * `invariants.test.js` cross-checks this list BOTH against the top-level markers
 * parsed out of the source (source drift) AND against the imported set (test drift).
 * The two INDENTED inner-closure markers (inside `retrieveErrorStack`-style factory
 * bodies) are excluded by the line-start `^` anchor — they are not export markers.
 */
export const THROW_SAFE_MARKED = [
  'isValidWeakKey',
  'getSafePrototypeOf',
  'hasOwnPrototype',
  'hasOwnWritablePrototype',
  'hasOwnNonWritablePrototype',
  'isValidPropertyKey',
  'getSafeOwnPropertyNames',
  'getSafeOwnPropertySymbols',
  'getSafeOwnPropertyKeys',
  'getNextAvailableSafeDescriptor',
  'hasInertMethod',
  'hasInertGetter',
  'hasInertSetter',
  'hasInertValue',
  'getVerifiedOwnName',
  'getTypeSignature',
  'getTaggedType',
  'getDefinedConstructor',
  'getDefinedConstructorName',
  'resolveType',
  'getValidatedStandardConstructorAndPrototypeTuple',
];

// Columns shared verbatim by every hostile row (the mechanism never reaches these
// functions' reads, or reaches an absorbing `try/catch` regardless of mechanism).
const invariantColumns = {
  isValidWeakKey: true, // typeof-only; a Proxy is a valid weak key
  isValidPropertyKey: false, // typeof-only; an object is not a property key
  hasOwnPrototype: false, // no own `prototype` on any hostile target
  hasOwnWritablePrototype: false,
  hasOwnNonWritablePrototype: false,
  getSafeOwnPropertyNames: TS_SENTINEL.EMPTY,
  getSafeOwnPropertySymbols: TS_SENTINEL.EMPTY,
  getSafeOwnPropertyKeys: TS_SENTINEL.EMPTY,
  getNextAvailableSafeDescriptor: TS_SENTINEL.UNDEF, // no `then` reachable / absorbed
  hasInertMethod: false,
  hasInertGetter: false,
  hasInertSetter: false,
  hasInertValue: false,
  getVerifiedOwnName: TS_SENTINEL.UNDEF, // no own `name` reachable
};

export const throwSafetyMatrix = {
  protoTrap: {
    surface: 'proto-trap: Proxy whose `getPrototypeOf` throws',
    make: throwingProtoTrapProxy,
    // spec throw-safety `B` vectors this mechanism drives (the absorbing cells):
    // `getSafePrototypeOf` and the severed-chain `getDefinedConstructor` arm.
    vectors: ['gSPO/B1', 'gDC/B1'],
    expected: {
      ...invariantColumns,
      getSafePrototypeOf: TS_SENTINEL.UNDEF, // absorbed — this trap's prime victim
      getTypeSignature: '[object Object]', // toString never reads the prototype
      getTaggedType: 'Object',
      getDefinedConstructor: TS_SENTINEL.UNDEF, // chain severed at the pivot
      getDefinedConstructorName: TS_SENTINEL.UNDEF,
      resolveType: 'Object', // via the tag fallback (no constructor name)
    },
  },
  descTrap: {
    surface: 'desc-trap: Proxy whose `getOwnPropertyDescriptor` throws',
    make: throwingDescTrapProxy,
    // the descriptor-read throw-safety of the `hasOwn*` family, the own-`name` read,
    // the Safe descriptor walk, and the `hasInert*` probes.
    vectors: ['hOP/B1', 'hOWP/B1', 'hONWP/B1', 'gVON/B1', 'gNASD/B1', 'hIM/R6'],
    expected: {
      ...invariantColumns,
      getSafePrototypeOf: TS_SENTINEL.PROTOTYPE, // `getPrototypeOf` untrapped
      getTypeSignature: '[object Object]',
      getTaggedType: 'Object',
      getDefinedConstructor: Object, // walks the REAL `Object.prototype`, bypassing the trap
      getDefinedConstructorName: 'Object',
      resolveType: 'Object', // via the constructor name
    },
  },
  ownKeysTrap: {
    surface: 'own-keys-trap: Proxy whose `ownKeys` throws',
    make: throwingOwnKeysTrapProxy,
    // the throwing-trap clause of the safe own-key readers (happy + nullish clauses
    // are in spec.test.js).
    vectors: ['gSOPN/A1', 'gSOPS/A1', 'gSOPK/A1'],
    expected: {
      ...invariantColumns,
      // getSafeOwnProperty* absorb this trap (vs the honest-empty of the other
      // rows) — same value, the completeness guard keeps the cell explicit.
      getSafePrototypeOf: TS_SENTINEL.PROTOTYPE,
      getTypeSignature: '[object Object]',
      getTaggedType: 'Object',
      getDefinedConstructor: Object,
      getDefinedConstructorName: 'Object',
      resolveType: 'Object',
    },
  },
  tagTrap: {
    surface: 'tag-throw: value whose inherited `Symbol.toStringTag` getter throws',
    make: throwingTagInheritor,
    // the tag-read throw-safety of the type-signature readers. (`resolveType`'s
    // tag-fallback absorption, rT/B2, needs a value with NO reachable constructor —
    // covered in spec.test.js, since this make resolves `Object` and short-circuits.)
    vectors: ['gTS/B2', 'gTT/B2'],
    expected: {
      ...invariantColumns,
      getSafePrototypeOf: TS_SENTINEL.PROTOTYPE,
      getTypeSignature: TS_SENTINEL.UNDEF, // absorbed — this trap's prime victim
      getTaggedType: TS_SENTINEL.UNDEF, // absorbed (composes getTypeSignature)
      getDefinedConstructor: Object, // constructor walk never reads the tag
      getDefinedConstructorName: 'Object',
      resolveType: 'Object', // short-circuits on the name; tag getter never fires
    },
  },
};

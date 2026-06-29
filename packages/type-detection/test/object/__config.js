// @ts-check

/**
 * @module test/object/__config
 *
 * Test configuration for the `object` module: the candidate value-universe
 * (fresh-value factories) plus the axis-1 contract matrix scoring each clean
 * candidate against all four predicates — `isObject`, `isPlainObject`,
 * `isDictionaryObject`, `isPlainOrDictionaryObject`. The matrix makes the
 * subtype lattice (PlainObject / DictionaryObject as disjoint subtypes of
 * AnyObject, with PlainOrDictionaryObject their union) auditable at a glance.
 *
 * `spec.test.js` drives the matrix; the targeted axis suites (cross-realm,
 * adversarial, _internal) import the specific named factories they need.
 * Spoof / documented-admission candidates (the tag-spoofed dictionary, the
 * tampered-constructor plain object) are deliberately NOT in the matrix —
 * their rationale belongs in `adversarial.test.js` prose, not a silent data row.
 *
 * Mirrors `docs/spec/OBJECT.spec.md`.
 */

import { objectCreate } from '@/index.js';

import { foreignRealmEval } from '../_cross-realm.js';

// ----- candidate factories (fresh value per call) -----

// plain objects — constructor === Object, prototype === Object.prototype
export const emptyObject = () => ({});
export const objectWithProps = () => ({ a: 1 });
export const newObject = () => new Object();
export const objectCreateObjectProto = () => objectCreate(Object.prototype);

// dictionary objects — no prototype-chain
export const nullProtoObject = () => objectCreate(null);
export const nulledProtoObject = () => {
  const object = {};
  Object.setPrototypeOf(object, null);
  return object;
};
// a prototype-less hashmap carrying a user-supplied own `constructor` data key:
// still a dictionary — `getDefinedConstructor` ignores an own `constructor` (#047).
export const nullProtoWithConstructorKey = () =>
  Object.assign(objectCreate(null), { constructor: Object });
// `Object.prototype` itself — the boundary case. Its own `[[Prototype]]` is null
// and #047 ignores its own `constructor`, so it is a DictionaryObject, NOT a
// PlainObject (the `!!prototype` fast-reject in isPlainObject). The
// disjointness-guarding vector — the #059 regression that flipped
// isPlainObject(Object.prototype) false→true would fail this row.
export const objectPrototypeValue = () => Object.prototype;

// containers / instances — objects, but neither plain nor dictionary
export const array = () => [];
export const dateInstance = () => new Date();
export const mapInstance = () => new Map();
export const regExp = () => /re/;
export const classInstance = () =>
  new (class Foo {
    run() {
      return 0;
    }
  })();

// boxed primitives — objects, not plain
export const boxedString = () => new String('x');
export const boxedNumber = () => new Number(1);

// a plain object over a NON-Object.prototype plain object — fails fast-path and
// the chain-depth marker (its prototype's prototype is not null).
export const objectCreatePlainProto = () => objectCreate({ a: 1 });

// foreign-realm shapes (targeted by cross-realm.test.js)
export const foreignPlainObject = () => foreignRealmEval('({ a: 1 })');
export const foreignNewObject = () => foreignRealmEval('new Object()');
export const foreignArray = () => foreignRealmEval('[1, 2, 3]');
export const foreignDate = () => foreignRealmEval('new Date()');
export const foreignClassInstance = () => foreignRealmEval('new (class Foo {})()');

// spoof / boundary shapes (targeted by adversarial.test.js)
// a prototype-less object hand-decorated with an own `Symbol.toStringTag` that
// lies about its [[Class]] — the tag cross-validator rejects it (isDictionaryObject/R4).
export const tagSpoofedNullProto = () =>
  Object.assign(objectCreate(null), { [Symbol.toStringTag]: 'NotAnObject' });
// a plain object whose own `constructor` is tampered to point at the global
// Object while its prototype is a hand-crafted non-Object.prototype — the
// round-trip identity marker (4) rejects it (iOPE/R4).
export const tamperedConstructorPlainObject = () => {
  const fakePrototype = { constructor: Object };
  return objectCreate(fakePrototype);
};
// a value over a hollow `class extends null` whose `name` is redefined to
// 'Object'. Its `.prototype` satisfies ALL five identity markers — null-rooted,
// tag '[object Object]', own ctor-name 'Object', round-tripping `prototype` —
// yet carries only `constructor`, none of Object.prototype's methods. The
// member-surface marker (6) is the sole marker that rejects it (iOPE/R5,
// dIOPC/R1).
export const classExtendsNullRenamedObject = () => {
  class Spoof extends null {}
  Object.defineProperty(Spoof, 'name', { value: 'Object' });
  return objectCreate(Spoof.prototype);
};
// a hand-built null-proto prototype carrying the FULL canonical member set as
// non-enumerable callables — the documented residual: it passes the
// member-surface marker (dIOPC/A2). The structural contract closes the cheap
// spoof, not every conceivable one.
export const fullMemberSurfaceProto = () => {
  const proto = objectCreate(null);
  for (const name of [
    'constructor',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'toLocaleString',
    'toString',
    'valueOf',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__',
  ]) {
    Object.defineProperty(proto, name, {
      value: () => undefined,
      enumerable: false,
      configurable: true,
    });
  }
  return proto;
};
// a null-proto prototype carrying the full canonical member NAMES but with the
// wrong descriptor SHAPE — `toString` as an accessor (no callable `.value`),
// `valueOf` enumerable, `hasOwnProperty` a non-callable value. Each violates
// `isValidObjectPrototypeDescriptor` (must be a non-enumerable, callable-valued
// data property), so the member-surface marker rejects it (dIOPC/R3). Closes the
// "right names, wrong shape" spoof the residual fixture (dIOPC/A2) does NOT cover.
export const wrongShapeMemberSurfaceProto = () => {
  const proto = objectCreate(null);
  for (const name of [
    'constructor',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'toLocaleString',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__',
  ]) {
    Object.defineProperty(proto, name, {
      value: () => undefined,
      enumerable: false,
      configurable: true,
    });
  }
  // the three wrong-shape members:
  Object.defineProperty(proto, 'toString', { get: () => () => undefined }); // accessor-form
  Object.defineProperty(proto, 'valueOf', { value: () => undefined, enumerable: true }); // enumerable
  Object.defineProperty(proto, 'hasOwnProperty', { value: 'not-a-function' }); // non-callable
  return proto;
};
// a hostile [[Prototype]] whose `ownKeys` trap throws — drives the member-surface
// read (`getOwnPropertyDescriptors`) into its try/catch, which must yield false,
// not propagate (dIOPC/B1). Reached standalone; in the predicate path marker 1
// fails first, so this is the only way to exercise marker 6's throw-safety.
export const throwingOwnKeysProto = () =>
  new Proxy(
    {},
    {
      ownKeys() {
        throw new Error('ownKeys-trap');
      },
    },
  );
// a real plain object whose constructor's `name` / `prototype` are exposed only
// via accessors — the descriptor-via-`.value` discipline yields undefined and
// rejects (the lying-accessor spoof surface).
export const accessorNameConstructorPrototype = () => {
  const proto = {};
  function FakeObject() {
    return undefined;
  }
  Object.defineProperty(FakeObject, 'name', { get: () => 'Object' });
  Object.defineProperties(proto, { constructor: { value: FakeObject } });
  return objectCreate(proto);
};

// ----- throw-safety probes (targeted by adversarial.test.js) -----
// The object predicates must answer a boolean on EVERY input, including hostile
// Proxies. Three distinct trap surfaces, attacked from every angle:

// (1) a hostile [[Prototype]] whose `getPrototypeOf` trap throws — hits the
// direct prototype reads (now `getInertPrototypeOf`).
export const throwingProtoTrapProxy = () =>
  new Proxy(
    {},
    {
      getPrototypeOf() {
        throw new Error('proto-trap');
      },
    },
  );

// (2) a value whose [[Prototype]] is a Proxy whose `getOwnPropertyDescriptor`
// trap throws — the constructor-walk (`getDefinedConstructor`) pivots INTO it;
// guarded by `getInertDescriptor` (#056).
export const valueOverThrowingProtoDescTrap = () =>
  objectCreate(
    new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error('proto-desc-trap');
        },
      },
    ),
  );

// (3) a value whose prototype's own `constructor` is a Proxy whose
// `getOwnPropertyDescriptor` trap throws ONLY for `'prototype'` (returning a
// normal `name: 'Object'`). This is the SURGICAL angle: it passes the cheap
// identity-signal gate (tag `[object Object]` + ctor-name `Object`) and so
// drives the hostile constructor INTO the contract walk — `isClass(constructor)`
// and markers 3/4 — the surface a blanket-throwing Proxy never reaches.
export const valueWithSurgicalHostileConstructor = () => {
  const constructor = new Proxy(
    class Object {
      run() {
        return 0;
      }
    },
    {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'prototype') {
          throw new Error('ctor-prototype-trap');
        }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    },
  );
  const proto = {};
  Object.defineProperty(proto, 'constructor', { value: constructor });
  return objectCreate(proto);
};

// (4) a value whose prototype's own `constructor` is a Proxy whose
// `getOwnPropertyDescriptor` trap throws for EVERY key — the blanket angle,
// caught earlier by the throw-safe identity-signal gate (name read → undefined).
export const valueWithBlanketHostileConstructor = () => {
  const constructor = new Proxy(
    class Object {
      run() {
        return 0;
      }
    },
    {
      getOwnPropertyDescriptor() {
        throw new Error('ctor-blanket-trap');
      },
    },
  );
  const proto = {};
  Object.defineProperty(proto, 'constructor', { value: constructor });
  return objectCreate(proto);
};

// ----- axis-1 contract matrix -----
// Each row: a fresh-value factory + the expected outcome of all four predicates
// + the spec vector IDs the row covers. `spec.test.js` asserts every cell and
// guards that every row scores every predicate (no silent gaps).

/**
 * @typedef {object} SpecRow
 * @property {string} description - human-readable candidate description
 * @property {() => unknown} make - fresh-value factory
 * @property {{ isObject: boolean, isPlainObject: boolean, isDictionaryObject: boolean, isPlainOrDictionaryObject: boolean }} expected - expected outcome of each predicate
 * @property {string[]} vectors - spec vector IDs this row covers
 */

const T = true;
const F = false;

/** @type {Record<string, SpecRow>} */
export const specMatrix = {
  emptyObject: {
    description: 'a plain empty object `{}`',
    make: emptyObject,
    expected: {
      isObject: T,
      isPlainObject: T,
      isDictionaryObject: F,
      isPlainOrDictionaryObject: T,
    },
    vectors: [
      'isObject/A1',
      'isPlainObject/A1',
      'isDictionaryObject/R1',
      'isPlainOrDictionaryObject/A1',
    ],
  },
  objectWithProps: {
    description: 'a plain object with own data `{ a: 1 }`',
    make: objectWithProps,
    expected: {
      isObject: T,
      isPlainObject: T,
      isDictionaryObject: F,
      isPlainOrDictionaryObject: T,
    },
    vectors: ['isObject/A1', 'isPlainObject/A1'],
  },
  newObject: {
    description: 'a `new Object()` instance',
    make: newObject,
    expected: {
      isObject: T,
      isPlainObject: T,
      isDictionaryObject: F,
      isPlainOrDictionaryObject: T,
    },
    vectors: ['isPlainObject/A1', 'isPlainOrDictionaryObject/A1'],
  },
  objectCreateObjectProto: {
    description: '`Object.create(Object.prototype)`',
    make: objectCreateObjectProto,
    expected: {
      isObject: T,
      isPlainObject: T,
      isDictionaryObject: F,
      isPlainOrDictionaryObject: T,
    },
    vectors: ['isPlainObject/A1'],
  },
  nullProtoObject: {
    description: '`Object.create(null)` — a dictionary object',
    make: nullProtoObject,
    expected: {
      isObject: T,
      isPlainObject: F,
      isDictionaryObject: T,
      isPlainOrDictionaryObject: T,
    },
    vectors: [
      'isObject/A3',
      'isPlainObject/R3',
      'isDictionaryObject/A1',
      'isPlainOrDictionaryObject/A2',
    ],
  },
  nulledProtoObject: {
    description: 'an object whose prototype was later nulled',
    make: nulledProtoObject,
    expected: {
      isObject: T,
      isPlainObject: F,
      isDictionaryObject: T,
      isPlainOrDictionaryObject: T,
    },
    vectors: ['isDictionaryObject/A2'],
  },
  nullProtoWithConstructorKey: {
    description: 'a null-prototype hashmap carrying an own `constructor` key',
    make: nullProtoWithConstructorKey,
    expected: {
      isObject: T,
      isPlainObject: F,
      isDictionaryObject: T,
      isPlainOrDictionaryObject: T,
    },
    vectors: ['isDictionaryObject/A3'],
  },
  objectPrototypeValue: {
    description: '`Object.prototype` itself — a dictionary, not a plain object',
    make: objectPrototypeValue,
    expected: {
      isObject: T,
      isPlainObject: F,
      isDictionaryObject: T,
      isPlainOrDictionaryObject: T,
    },
    vectors: [
      'isPlainObject/R7',
      'isDictionaryObject/A4',
      'isPlainOrDictionaryObject/A4',
    ],
  },
  array: {
    description: 'an array `[]`',
    make: array,
    expected: {
      isObject: T,
      isPlainObject: F,
      isDictionaryObject: F,
      isPlainOrDictionaryObject: F,
    },
    vectors: [
      'isObject/A2',
      'isPlainObject/R1',
      'isDictionaryObject/R2',
      'isPlainOrDictionaryObject/R1',
    ],
  },
  dateInstance: {
    description: 'a `Date` instance',
    make: dateInstance,
    expected: {
      isObject: T,
      isPlainObject: F,
      isDictionaryObject: F,
      isPlainOrDictionaryObject: F,
    },
    vectors: ['isObject/A2', 'isPlainObject/R1', 'isDictionaryObject/R2'],
  },
  mapInstance: {
    description: 'a `Map` instance',
    make: mapInstance,
    expected: {
      isObject: T,
      isPlainObject: F,
      isDictionaryObject: F,
      isPlainOrDictionaryObject: F,
    },
    vectors: ['isObject/A2', 'isPlainObject/R1'],
  },
  regExp: {
    description: 'a regular expression `/re/`',
    make: regExp,
    expected: {
      isObject: T,
      isPlainObject: F,
      isDictionaryObject: F,
      isPlainOrDictionaryObject: F,
    },
    vectors: ['isObject/A2', 'isPlainObject/R1'],
  },
  classInstance: {
    description: 'a `class Foo {}` instance',
    make: classInstance,
    expected: {
      isObject: T,
      isPlainObject: F,
      isDictionaryObject: F,
      isPlainOrDictionaryObject: F,
    },
    vectors: [
      'isObject/A5',
      'isPlainObject/R2',
      'isDictionaryObject/R2',
      'isPlainOrDictionaryObject/R1',
    ],
  },
  boxedString: {
    description: 'a boxed `new String("x")`',
    make: boxedString,
    expected: {
      isObject: T,
      isPlainObject: F,
      isDictionaryObject: F,
      isPlainOrDictionaryObject: F,
    },
    vectors: ['isObject/A4', 'isPlainObject/R4'],
  },
  boxedNumber: {
    description: 'a boxed `new Number(1)`',
    make: boxedNumber,
    expected: {
      isObject: T,
      isPlainObject: F,
      isDictionaryObject: F,
      isPlainOrDictionaryObject: F,
    },
    vectors: ['isObject/A4'],
  },
  objectCreatePlainProto: {
    description: '`Object.create({ a: 1 })` — a non-Object.prototype plain proto',
    make: objectCreatePlainProto,
    expected: {
      isObject: T,
      isPlainObject: F,
      isDictionaryObject: F,
      isPlainOrDictionaryObject: F,
    },
    vectors: [
      'isPlainObject/R5',
      'isDictionaryObject/R3',
      'isPlainOrDictionaryObject/R2',
    ],
  },
};

// ----- cross-cutting rejection inputs (all four predicates → false) -----
// Keys are the spec cross-cutting vector groups — covering CC/nullish,
// CC/primitive, and CC/function (`function` = `typeof === 'function'`: arrow /
// class / named-function forms). `spec.test.js` labels each it-name `CC/${group}`
// and asserts all four predicates (incl. isObject/R1) so the coverage is
// grep-traceable to the spec.
export const crossCuttingRejections = {
  nullish: [null, undefined],
  primitive: [0, '', false, NaN, 0n, 42, 'x', true, 1n, Symbol('s')],
  function: [
    () => undefined,
    class {
      run() {
        return 0;
      }
    },
    function named() {
      return undefined;
    },
  ],
};

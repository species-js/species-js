// @ts-check

/**
 * Axis-1 (contract) suite for `@species-js/custom-namespace`.
 *
 * The oracle is `docs/spec/CUSTOM-NAMESPACE.spec.md`, frozen 2026-09-04. Every
 * `it` cites the spec vector it asserts, literally and un-interpolated, so the
 * spec-to-test diff stays greppable in both directions.
 *
 * One file, organized by describe-block per spec dimension — the non-predicate
 * layout type-detection's `config` round established. There is no matrix config,
 * no cross-realm file and no adversarial file: the package exposes one builder,
 * not a predicate lattice, and its hostile-input behavior is to THROW rather
 * than to answer, which the `fail/*` block covers directly.
 *
 * The five `type/T*` vectors are not here. They are compile-time claims, gated
 * by `pnpm run typecheck` through `test/type-contract.js`.
 */

import { describe, it, expect } from 'vitest';

import { createCustomNamespace } from '#index';
import {
  getOwnPropertyDescriptor as rawGetOwnPropertyDescriptor,
  globalContext,
  objectAssign,
  objectFreeze,
  defineProperty,
} from '#config';
import { isDictionaryObject, objectCreate } from '@species-js/type-detection';

/**
 * @param {unknown} value - the value to brand-check
 * @returns {string} its `[[Class]]` brand
 */
const tagOf = (value) => Object.prototype.toString.call(value);

/**
 * `String(…)` over an `unknown` operand.
 *
 * Typed this way on purpose. `@typescript-eslint/no-base-to-string` reads the
 * DECLARED type and reports that a namespace stringifies as `[object Object]`,
 * because `CustomNamespace` declares `Symbol.toPrimitive` and no `toString` —
 * and the rule does not consider the former. The runtime answer is
 * `"[namespace '<name>']"`, which `ns/A4` asserts directly.
 * @param {unknown} value - the value to stringify
 * @returns {string} its string conversion
 */
const stringify = (value) => String(value);

/** A place for a setter to put what it was handed, so it is never empty. */
const sink = { last: /** @type {unknown} */ (undefined) };

/**
 * @returns {PropertyDescriptor} a visible, configurable setter-only descriptor
 */
const setterOnly = () => ({
  set(/** @type {unknown} */ value) {
    sink.last = value;
  },
  enumerable: true,
  configurable: true,
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  A — Argument contract
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('custom-namespace spec — A: the `name` argument', () => {
  it('ccn/A1 — a string name is accepted and renders into the representation', () => {
    expect(stringify(createCustomNamespace('demo', { a: 1 }))).toBe("[namespace 'demo']");
  });

  it('ccn/A2 — a boxed String is admitted and unboxed', () => {
    const boxed = /** @type {string} */ (/** @type {unknown} */ (new String('boxed')));

    expect(stringify(createCustomNamespace(boxed, { a: 1 }))).toBe("[namespace 'boxed']");
  });

  it('ccn/R1 — a non-string name throws TypeError and is never coerced', () => {
    const notStrings = [42, null, undefined, Symbol('s'), {}];

    expect(notStrings).toHaveLength(5);

    for (const candidate of notStrings) {
      const build = () =>
        createCustomNamespace(
          /** @type {string} */ (/** @type {unknown} */ (candidate)),
          {
            a: 1,
          },
        );

      expect(build).toThrow(TypeError);
      expect(build).toThrow(`'name' must be a string.`);
    }
  });

  it('ccn/B1 — a whitespace-only name is accepted and trims to empty', () => {
    expect(stringify(createCustomNamespace('   ', { a: 1 }))).toBe("[namespace '']");
  });

  it('ccn/B2 — the name is neither escaped nor otherwise restricted', () => {
    expect(stringify(createCustomNamespace("a'b", { a: 1 }))).toBe("[namespace 'a'b']");
    expect(stringify(createCustomNamespace('a\nb', { a: 1 }))).toBe("[namespace 'a\nb']");
  });

  it('ccn/B3 — the name is trimmed at the edges only', () => {
    expect(stringify(createCustomNamespace('  a b  ', { a: 1 }))).toBe(
      "[namespace 'a b']",
    );
  });
});

describe('custom-namespace spec — A: the `exports` argument', () => {
  it('ccn/A3 — an object literal is accepted', () => {
    expect(createCustomNamespace('n', { a: 1 }).a).toBe(1);
  });

  it('ccn/A4 — a prototype-less dictionary is accepted', () => {
    const dictionary = /** @type {{ a: number }} */ (
      objectAssign(objectCreate(null), { a: 1 })
    );

    expect(createCustomNamespace('n', dictionary).a).toBe(1);
  });

  it('ccn/A5 — a benign Proxy over an admitted shape is accepted', () => {
    expect(createCustomNamespace('n', new Proxy({ a: 1 }, {})).a).toBe(1);
  });

  it('ccn/R2 — an array, function, class instance or primitive throws TypeError', () => {
    class C {
      value() {
        return 1;
      }
    }
    const notObjects = [[], () => undefined, new C(), 'str', 1, null, undefined];

    expect(notObjects).toHaveLength(7);

    for (const candidate of notObjects) {
      expect(() => createCustomNamespace('n', /** @type {object} */ (candidate))).toThrow(
        TypeError,
      );
    }
  });

  it('ccn/R3 — a source carrying a custom prototype chain is refused outright', () => {
    const source = /** @type {{ own: string }} */ (objectCreate({ inherited: 'no' }));

    source.own = 'yes';

    expect(() => createCustomNamespace('n', source)).toThrow(TypeError);
  });

  it('ccn/R4 — an already-built namespace is not raw material', () => {
    const namespace = createCustomNamespace('inner', { a: 1 });

    expect(() => createCustomNamespace('outer', namespace)).toThrow(TypeError);
  });

  it('ccn/R5 — a source with no own property throws TypeError', () => {
    expect(() => createCustomNamespace('n', {})).toThrow(
      `'exports' must carry at least one own property`,
    );
  });

  it('ccn/R6 — a source carrying a reserved key throws, naming the symbols', () => {
    expect(() => createCustomNamespace('n', { [Symbol.toStringTag]: 'X', a: 1 })).toThrow(
      /must not carry the reserved Symbol\(Symbol\.toStringTag\)/,
    );
    expect(() =>
      createCustomNamespace('n', {
        [Symbol.toPrimitive]: () => 'x',
        [Symbol.toStringTag]: 'X',
      }),
    ).toThrow(/Symbol\(Symbol\.toPrimitive\) and Symbol\(Symbol\.toStringTag\)/);
  });

  it('ccn/B4 — the CONTENTS of a namespace are accepted, yielding a new one', () => {
    const namespace = createCustomNamespace('n', { a: 1 });
    const rebuilt = createCustomNamespace('n2', { ...namespace });

    expect(stringify(rebuilt)).toBe("[namespace 'n2']");
    expect(rebuilt.a).toBe(1);
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  B — Member resolution
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('custom-namespace spec — B: member resolution', () => {
  it('mem/A1 — a data member lands as a frozen, visible data property', () => {
    const namespace = createCustomNamespace('n', { a: 1 });

    expect(Object.getOwnPropertyDescriptor(namespace, 'a')).toEqual({
      value: 1,
      enumerable: true,
      writable: false,
      configurable: false,
    });
  });

  it('mem/A2 — a non-enumerable member stays readable but invisible', () => {
    const source = /** @type {{ hidden: number }} */ (
      Object.defineProperty({}, 'hidden', {
        value: 7,
        enumerable: false,
        configurable: true,
      })
    );
    const namespace = createCustomNamespace('n', source);
    const seen = [];

    for (const key in namespace) {
      seen.push(key);
    }

    expect(namespace.hidden).toBe(7);
    expect(Object.keys(namespace)).toEqual([]);
    expect(seen).toEqual([]);
    expect(JSON.stringify(namespace)).toBe('{}');
    expect({ ...namespace }).toEqual({});
    expect(Object.assign({}, namespace)).toEqual({});
    expect(Object.getOwnPropertyNames(namespace)).toEqual(['hidden']);
  });

  it('mem/A3 — a getter runs exactly once, at build time, and is snapshotted', () => {
    let calls = 0;
    let backing = 'first';
    const source = {
      get live() {
        calls += 1;
        return backing;
      },
    };
    const namespace = createCustomNamespace('n', source);

    expect(calls).toBe(1);

    backing = 'second';

    expect(namespace.live).toBe('first');
    expect(namespace.live).toBe('first');
    expect(calls).toBe(1);
  });

  it('mem/A4 — a getter is invoked with the source as receiver', () => {
    const source = {
      sibling: 'visible',
      get reads() {
        return this.sibling;
      },
    };

    expect(createCustomNamespace('n', source).reads).toBe('visible');
  });

  it('mem/A5 — a symbol-keyed member is included on the same terms', () => {
    const key = Symbol('member');
    const namespace = createCustomNamespace('n', { [key]: 'v' });

    expect(namespace[key]).toBe('v');
    expect(Object.getOwnPropertySymbols(namespace)).toContain(key);
  });

  it('mem/A6 — an accessor member honors `enumerable` as a data member does', () => {
    const source = Object.defineProperty({}, 'acc', {
      get: () => 3,
      enumerable: false,
      configurable: true,
    });
    const namespace = createCustomNamespace('n', source);

    expect(Object.getOwnPropertyDescriptor(namespace, 'acc')).toEqual({
      value: 3,
      enumerable: false,
      writable: false,
      configurable: false,
    });
  });

  it('mem/A7 — a member may be anything the author exports', () => {
    const namespace = createCustomNamespace('n', {
      fn: () => 1,
      nil: null,
      undef: undefined,
      nested: { a: 1 },
    });

    expect(namespace.fn()).toBe(1);
    expect(namespace.nil).toBe(null);
    expect(namespace.undef).toBe(undefined);
    expect(Object.getOwnPropertyNames(namespace)).toEqual([
      'fn',
      'nil',
      'undef',
      'nested',
    ]);
  });

  it('mem/R1 — a setter-only member throws TypeError, naming the key', () => {
    const source = Object.defineProperty({}, 'writeOnly', setterOnly());

    expect(() => createCustomNamespace('n', source)).toThrow(TypeError);
    expect(() => createCustomNamespace('n', source)).toThrow(
      `'exports' member writeOnly must be readable`,
    );
  });

  it('mem/R2 — an accessor carrying neither half throws TypeError', () => {
    const source = Object.defineProperty(
      {},
      'neither',
      /** @type {PropertyDescriptor} */ (
        /** @type {unknown} */ ({
          get: undefined,
          set: undefined,
          enumerable: true,
          configurable: true,
        })
      ),
    );

    expect(() => createCustomNamespace('n', source)).toThrow(TypeError);
  });

  it('mem/R3 — a symbol-keyed valueless member names its key without coercing', () => {
    const key = Symbol('writeOnly');
    const source = Object.defineProperty({}, key, setterOnly());

    expect(() => createCustomNamespace('n', source)).toThrow(
      /member Symbol\(writeOnly\) must be readable/,
    );
  });

  it('mem/R4 — an all-valueless source throws, so an empty namespace is unreachable', () => {
    const source = Object.defineProperties({}, { a: setterOnly(), b: setterOnly() });

    expect(() => createCustomNamespace('n', source)).toThrow(TypeError);
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  C — The produced artifact
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('custom-namespace spec — C: the produced artifact', () => {
  it('ns/A1 — the namespace has a null prototype', () => {
    expect(Object.getPrototypeOf(createCustomNamespace('n', { a: 1 }))).toBe(null);
  });

  it('ns/A2 — the namespace is frozen, sealed and non-extensible', () => {
    const namespace = createCustomNamespace('n', { a: 1 });

    expect(Object.isFrozen(namespace)).toBe(true);
    expect(Object.isSealed(namespace)).toBe(true);
    expect(Object.isExtensible(namespace)).toBe(false);
  });

  it('ns/A3 — the namespace answers [object CustomNamespace]', () => {
    expect(tagOf(createCustomNamespace('n', { a: 1 }))).toBe('[object CustomNamespace]');
  });

  it('ns/A4 — String, template and concatenation agree on one form', () => {
    const namespace = createCustomNamespace('demo', { a: 1 });
    // - cast for the CHECKER only; the runtime value IS the namespace, so both
    //   conversions below are performed BY it. Interpolating or concatenating a
    //   pre-stringified value would assert nothing about the namespace at all.
    //   The two arms differ in hint: a template literal takes 'string', `+`
    //   takes 'default' — the one conversion `String()` does not exercise.
    const asOperand = /** @type {string} */ (/** @type {unknown} */ (namespace));

    expect(stringify(namespace)).toBe("[namespace 'demo']");
    expect(`<${asOperand}>`).toBe("<[namespace 'demo']>");
    expect(asOperand + '!').toBe("[namespace 'demo']!");
  });

  it('ns/A5 — the namespace has no numeric meaning', () => {
    expect(Number(createCustomNamespace('demo', { a: 1 }))).toBeNaN();
  });

  it('ns/A6 — both structural symbols are hidden, non-writable, non-configurable', () => {
    const namespace = createCustomNamespace('n', { a: 1 });
    const symbols = [Symbol.toStringTag, Symbol.toPrimitive];

    expect(symbols).toHaveLength(2);

    for (const symbol of symbols) {
      const descriptor = /** @type {PropertyDescriptor} */ (
        Object.getOwnPropertyDescriptor(namespace, symbol)
      );

      // - the exact key set pins it as a DATA descriptor: an accessor pair would
      //   carry `get`/`set` instead of `value`/`writable`.
      expect(Object.keys(descriptor).sort()).toEqual([
        'configurable',
        'enumerable',
        'value',
        'writable',
      ]);
      expect(descriptor.enumerable).toBe(false);
      expect(descriptor.writable).toBe(false);
      expect(descriptor.configurable).toBe(false);
    }
  });

  it('ns/A7 — a copy carries the contents but never the identity', () => {
    const namespace = createCustomNamespace('n', { a: 1 });
    const spread = { ...namespace };
    const assigned = Object.assign({}, namespace);

    expect(tagOf(spread)).toBe('[object Object]');
    expect(tagOf(assigned)).toBe('[object Object]');
    expect(Object.getOwnPropertySymbols(spread)).toEqual([]);
    expect(spread).toEqual({ a: 1 });
    expect(assigned).toEqual({ a: 1 });
  });

  it('ns/B1 — the freeze is shallow: a member object stays mutable', () => {
    const namespace = createCustomNamespace('n', { inner: { mutable: 1 } });

    namespace.inner.mutable = 2;

    expect(namespace.inner.mutable).toBe(2);
    expect(Object.isFrozen(namespace.inner)).toBe(false);
  });

  it('ns/B2 — own-key order follows the ECMAScript rule, not literal order', () => {
    const namespace = createCustomNamespace('n', { b: 1, 2: 2, a: 3, 1: 4 });

    expect(Object.getOwnPropertyNames(namespace)).toEqual(['1', '2', 'b', 'a']);
  });

  it('ns/B3 — there is no toString: implicit conversion works, an explicit call throws', () => {
    const namespace = createCustomNamespace('n', { a: 1 });
    const withOwnToString = createCustomNamespace('fmt', {
      toString: () => 'author-supplied',
    });
    // - asserting the ABSENCE directly, then that invoking it throws. Written as
    //   a property read rather than a `namespace.toString()` call so the claim
    //   does not depend on how a linter resolves the cast.
    const asRecord = /** @type {Record<string, unknown>} */ (
      /** @type {unknown} */ (namespace)
    );
    // - `no-base-to-string` fires on any reference to `.toString` here, which is
    //   the very rule this vector documents: it reads the declared type and does
    //   not see `Symbol.toPrimitive`. The ABSENCE is what is being asserted.
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    const callToString = () => /** @type {() => string} */ (asRecord.toString)();

    expect(Object.getOwnPropertyNames(namespace)).toEqual(['a']);
    expect(asRecord.toString).toBe(undefined);
    expect(callToString).toThrow(TypeError);
    expect(stringify(namespace)).toBe("[namespace 'n']");

    // - an author-exported `toString` coexists: the member answers the explicit
    //   call while `Symbol.toPrimitive` still governs the string conversion.
    expect(withOwnToString.toString()).toBe('author-supplied');
    expect(stringify(withOwnToString)).toBe("[namespace 'fmt']");
  });

  it('ns/R1 — a namespace is not a dictionary object; the brand disqualifies it', () => {
    expect(isDictionaryObject(createCustomNamespace('n', { a: 1 }))).toBe(false);
  });
});

describe('custom-namespace spec — C: the Symbol.toPrimitive implementation', () => {
  it('prim/A1 — all three engine hints answer the same representation', () => {
    const namespace = createCustomNamespace('demo', { a: 1 });
    const toPrimitive = namespace[Symbol.toPrimitive];
    const hints = ['string', 'number', 'default'];

    expect(hints).toHaveLength(3);

    for (const hint of hints) {
      expect(toPrimitive(hint)).toBe("[namespace 'demo']");
    }
  });

  it('prim/R1 — any other hint yields undefined, inherited names included', () => {
    const toPrimitive = createCustomNamespace('demo', { a: 1 })[Symbol.toPrimitive];
    const misses = ['toString', 'constructor', 'valueOf', '__proto__', 'nope', ''];

    expect(misses).toHaveLength(6);

    for (const hint of misses) {
      expect(toPrimitive(hint)).toBe(undefined);
    }
  });

  it('prim/B1 — a hint whose own toString throws propagates', () => {
    const toPrimitive = createCustomNamespace('demo', { a: 1 })[Symbol.toPrimitive];
    const hostileHint = /** @type {string} */ (
      /** @type {unknown} */ ({
        toString() {
          throw new RangeError('hint');
        },
      })
    );

    expect(() => toPrimitive(hostileHint)).toThrow(RangeError);
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  D — Failure semantics
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('custom-namespace spec — D: failure semantics', () => {
  it('fail/A1 — the first blocker wins across the whole-argument checks', () => {
    expect(() =>
      createCustomNamespace(
        /** @type {string} */ (/** @type {unknown} */ (42)),
        /** @type {object} */ (/** @type {unknown} */ ('not-an-object')),
      ),
    ).toThrow(`'name' must be a string.`);
  });

  it('fail/A2 — a later key’s getter does not run once a key has failed', () => {
    let laterRan = false;
    const source = Object.defineProperties(
      {},
      {
        a: setterOnly(),
        b: {
          get() {
            laterRan = true;
            return 1;
          },
          enumerable: true,
          configurable: true,
        },
      },
    );

    expect(() => createCustomNamespace('n', source)).toThrow(/member a must be readable/);
    expect(laterRan).toBe(false);
  });

  it('fail/A3 — a hostile getOwnPropertyDescriptor trap propagates unwrapped', () => {
    const hostile = new Proxy(
      { a: 1 },
      {
        getOwnPropertyDescriptor() {
          throw new RangeError('trap');
        },
      },
    );

    expect(() => createCustomNamespace('n', hostile)).toThrow(RangeError);
  });

  it('fail/A4 — a getter that throws propagates unwrapped', () => {
    const source = {
      get boom() {
        throw new RangeError('getter');
      },
    };

    expect(() => createCustomNamespace('n', source)).toThrow(RangeError);
  });

  it('fail/A5 — a key ownKeys lists but no descriptor describes throws TypeError', () => {
    const hostile = new Proxy(
      {},
      {
        ownKeys: () => ['ghost'],
        getOwnPropertyDescriptor: () => undefined,
      },
    );

    expect(() => createCustomNamespace('n', hostile)).toThrow(TypeError);
  });

  it('fail/B1 — the builder is not transactional: earlier getters have already run', () => {
    const ran = /** @type {string[]} */ ([]);
    /**
     * @param {string} label - what the getter records and returns
     * @returns {PropertyDescriptor} a visible, configurable recording accessor
     */
    const recordingGetter = (label) => ({
      get() {
        ran.push(label);
        return label;
      },
      enumerable: true,
      configurable: true,
    });
    const source = Object.defineProperties(
      {},
      {
        a: recordingGetter('a'),
        b: recordingGetter('b'),
        c: setterOnly(),
        d: recordingGetter('d'),
      },
    );

    expect(() => createCustomNamespace('n', source)).toThrow(/member c must be readable/);
    expect(ran).toEqual(['a', 'b']);
  });

  it('fail/B2 — the first offending key is first in own-key order', () => {
    const source = Object.defineProperties({}, { b: setterOnly(), 1: setterOnly() });

    expect(() => createCustomNamespace('n', source)).toThrow(/member 1 must be readable/);
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Realm-fixed captures
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('custom-namespace spec — realm-fixed captures', () => {
  it('cap/A1 — every #config export is identity-equal to its intrinsic', () => {
    expect(globalContext).toBe(globalThis);
    expect(objectAssign).toBe(Object.assign);
    expect(objectFreeze).toBe(Object.freeze);
    expect(defineProperty).toBe(Object.defineProperty);
    expect(rawGetOwnPropertyDescriptor).toBe(Object.getOwnPropertyDescriptor);
  });

  it('cap/A2 — the descriptor read is the RAW capture, not a throw-safe wrapper', () => {
    const hostile = new Proxy(
      { a: 1 },
      {
        getOwnPropertyDescriptor() {
          throw new RangeError('trap');
        },
      },
    );

    expect(() => rawGetOwnPropertyDescriptor(hostile, 'a')).toThrow(RangeError);
  });
});

// @ts-check

/**
 * @module test/utility/invariants
 *
 * Standing structural-invariant oracle for `#utility` — the low-level reader/probe
 * layer every other module routes its reflective reads through. Promoted from the
 * back-sweep's ephemeral hostile-probe into a committed, always-run suite
 * (Phase 2). Unlike the predicate modules, `#utility` has no discrimination lattice
 * (no refinement / disjointness / union laws), so its spec-free relationship laws
 * are the two that apply to a pure reader layer:
 *
 *   A. COMPLETENESS TRIPLE-LOCK — the `@@throw-safe` marked set is pinned from three
 *      sides: the top-level markers parsed out of `src/utility/index.js` (source
 *      drift), the canonical {@link THROW_SAFE_MARKED} list, and the imported set
 *      scored below (test drift). `throw-safety.test.js` scores the 20 public marks
 *      against the hostile matrix and `_internal/helpers.test.js` scores the sole
 *      `@internal` mark, but neither locks its function list to the source — this
 *      does, so a marker added or removed without updating the oracle fails here.
 *   B. DETERMINISM — a reader is a pure function of its input: repeated calls on the
 *      same value agree. This is the spec-free law that guards the #059 posture
 *      (the constructor registries were REMOVED in favour of resolve-once-and-thread)
 *      — a reader that cached across calls, or leaked stateful residue, would break
 *      it. Asserted over a broad value corpus, hostile inputs included.
 *
 * Throw-safety (that no marked reader propagates on hostile input) is covered
 * exhaustively by the `throw-safety.test.js` hostile × function matrix; this suite
 * assumes it and asserts the completeness + determinism laws it does not.
 */

import { readFileSync } from 'node:fs';

import { describe, it, expect } from 'vitest';

import {
  isValidWeakKey,
  getSafePrototypeOf,
  hasOwnPrototype,
  hasOwnWritablePrototype,
  hasOwnNonWritablePrototype,
  isValidPropertyKey,
  getSafeOwnPropertyNames,
  getSafeOwnPropertySymbols,
  getSafeOwnPropertyKeys,
  getNextAvailableSafeDescriptor,
  hasInertMethod,
  hasInertGetter,
  hasInertSetter,
  hasInertValue,
  getVerifiedOwnName,
  getTypeSignature,
  getTaggedType,
  getDefinedConstructor,
  getDefinedConstructorName,
  resolveType,
  getValidatedStandardConstructorAndPrototypeTuple,
  objectCreate,
} from '#index';

import {
  THROW_SAFE_MARKED,
  throwingProtoTrapProxy,
  throwingDescTrapProxy,
  throwingOwnKeysTrapProxy,
  throwingTagInheritor,
} from './__config.js';

// ----- Law A: the completeness triple-lock -----

// The full 21-mark imported set, keyed by name — the third side of the lock.
const markedImports = {
  isValidWeakKey,
  getSafePrototypeOf,
  hasOwnPrototype,
  hasOwnWritablePrototype,
  hasOwnNonWritablePrototype,
  isValidPropertyKey,
  getSafeOwnPropertyNames,
  getSafeOwnPropertySymbols,
  getSafeOwnPropertyKeys,
  getNextAvailableSafeDescriptor,
  hasInertMethod,
  hasInertGetter,
  hasInertSetter,
  hasInertValue,
  getVerifiedOwnName,
  getTypeSignature,
  getTaggedType,
  getDefinedConstructor,
  getDefinedConstructorName,
  resolveType,
  getValidatedStandardConstructorAndPrototypeTuple,
};

const markedSorted = [...THROW_SAFE_MARKED].sort();

/**
 * The `@@throw-safe`-marked export names parsed straight out of the source. The
 * line-start `^` anchor (with the `m` flag) matches ONLY top-level markers at column
 * zero, so the two INDENTED inner-closure markers (inside a factory body) are
 * excluded — they annotate a nested throw-safe closure, not an export.
 */
function markedNamesFromSource() {
  const source = readFileSync(
    new URL('../../src/utility/index.js', import.meta.url),
    'utf8',
  );
  return [
    ...source.matchAll(
      /^\/\* @@throw-safe \*\/[\s\S]*?export (?:function|const) (\w+)/gm,
    ),
  ].map((match) => match[1]);
}

describe('utility — structural invariants (A: completeness triple-lock)', () => {
  it('completeness (source): the top-level `@@throw-safe` markers in src/utility/index.js === the 21-name oracle', () => {
    expect(markedNamesFromSource().sort()).toEqual(markedSorted);
  });

  it('completeness (test): the imported marked set === the 21-name oracle', () => {
    expect(Object.keys(markedImports).sort()).toEqual(markedSorted);
  });
});

// ----- Law B: determinism -----

// A broad value corpus — plain shapes, container/instance shapes, prototype-less,
// callables, primitives, and the four hostile Proxy/tag traps. A reader must return
// the same answer on the second call as on the first for every one of them.
/** @type {Array<[string, () => unknown]>} */
const corpus = [
  ['plainObject', () => ({ a: 1 })],
  ['array', () => [1, 2, 3]],
  ['dateInstance', () => new Date()],
  ['promise', () => Promise.resolve(1)],
  [
    'classInstance',
    () =>
      new (class Foo {
        run() {
          return 0;
        }
      })(),
  ],
  ['nullProtoObject', () => objectCreate(null)],
  ['arrowFunction', () => () => undefined],
  [
    'namedFunction',
    () =>
      function named() {
        return undefined;
      },
  ],
  ['builtinCtor', () => Array],
  ['string', () => 'x'],
  ['number', () => 42],
  ['symbol', () => Symbol('s')],
  ['nullValue', () => null],
  ['undefinedValue', () => undefined],
  ['protoTrapProxy', throwingProtoTrapProxy],
  ['descTrapProxy', throwingDescTrapProxy],
  ['ownKeysTrapProxy', throwingOwnKeysTrapProxy],
  ['tagInheritor', throwingTagInheritor],
];

/** @type {Record<string, (value?: unknown) => unknown>} */
const valueReaders = {
  isValidWeakKey,
  isValidPropertyKey,
  hasOwnPrototype,
  hasOwnWritablePrototype,
  hasOwnNonWritablePrototype,
  getSafePrototypeOf,
  getSafeOwnPropertyNames,
  getSafeOwnPropertySymbols,
  getSafeOwnPropertyKeys,
  getVerifiedOwnName,
  getTypeSignature,
  getTaggedType,
  getDefinedConstructor,
  getDefinedConstructorName,
  resolveType,
};

/** @type {Record<string, (type: unknown, key: PropertyKey) => unknown>} */
const chainProbes = {
  getNextAvailableSafeDescriptor,
  hasInertMethod,
  hasInertGetter,
  hasInertSetter,
  hasInertValue,
};

const PROBE_KEY = 'then';

describe('utility — structural invariants (B: determinism — a reader is pure)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: every reader/probe agrees with itself on a repeated call`, () => {
      const v = make();
      for (const [name, read] of Object.entries(valueReaders)) {
        // toEqual (not toBe): the *-Names/-Symbols/-Keys readers return a fresh array
        // each call, so structural equality is the right determinism check; identity
        // readers (getSafePrototypeOf, getDefinedConstructor) pass it on ref-equality.
        expect(read(v), `${name}(${label})`).toEqual(read(v));
      }
      for (const [name, probe] of Object.entries(chainProbes)) {
        expect(probe(v, PROBE_KEY), `${name}(${label})`).toEqual(probe(v, PROBE_KEY));
      }
    });
  }

  it('getValidatedStandardConstructorAndPrototypeTuple is deterministic (success and surrogate)', () => {
    /** @type {import('#utility').PredicateFunction} */
    const accept = () => true;
    /** @type {import('#utility').PredicateFunction} */
    const reject = () => false;
    // success path — a genuine newable that passes the injected gate: same tuple.
    expect(getValidatedStandardConstructorAndPrototypeTuple(Object, accept)).toEqual(
      getValidatedStandardConstructorAndPrototypeTuple(Object, accept),
    );
    // surrogate path — a rejected gate collapses to the inert tuple, deterministically.
    expect(getValidatedStandardConstructorAndPrototypeTuple(Object, reject)).toEqual(
      getValidatedStandardConstructorAndPrototypeTuple(Object, reject),
    );
  });
});

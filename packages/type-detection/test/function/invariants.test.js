// @ts-check

/**
 * @module test/function/invariants
 *
 * Standing structural-invariant oracle for `#function` — the spec-free RELATIONSHIP
 * laws of the callable lattice, asserted over the full candidate corpus. The
 * absolute-value matrices in `spec.test.js` pin each candidate's verdict per
 * predicate; this suite pins the CROSS-PREDICATE relationships that must hold for
 * EVERY value, foreign / adversarial / hostile ones included. A violation is a real
 * bug regardless of what the spec says.
 *
 * ```
 *   isCallable                                    the floor — the [[Call]] slot
 *     isFunction                                  + the bind/call/apply surface
 *       isNewableFunction  ≡  isFunction ∧ hasConstructSlot
 *         isES3Function    ⊎  isClass             (own prototype: writable ⊎ non-writable)
 *                             isClass  ≡  isCustomClass ⊎ isBuiltInClass
 *       isAsyncFunction  |  isGeneratorFunction  ⊎  isAsyncGeneratorFunction
 *                           isAnyGeneratorFunction ≡ the two generator arms
 * ```
 *
 * The laws:
 *   A. CALLABILITY FLOOR — every public predicate implies `isCallable`, and every
 *      narrowing predicate below the floor implies `isFunction`. Nothing may be
 *      admitted by a refinement that the floor itself rejects.
 *   B. THE isClass PARTITION (the spec's named law) — `isClass(v) === isCustomClass(v)
 *      || isBuiltInClass(v)`, and the two arms are DISJOINT.
 *   C. THE NEWABLE LADDER — `isNewableFunction ≡ isFunction ∧ hasConstructSlot`;
 *      `isES3Function ⇒ isNewableFunction`; `isClass ⇒ isNewableFunction`; and
 *      `isES3Function` ⊎ `isClass` are disjoint (own `prototype` writable vs
 *      non-writable — a value cannot be both, and a bound constructor, owning no
 *      `prototype` at all, is neither).
 *   D. THE GENERATOR UMBRELLA — `isAnyGeneratorFunction(v) === isGeneratorFunction(v)
 *      || isAsyncGeneratorFunction(v)`, and the two arms are disjoint.
 *   E. ASYNC/GENERATOR EXCLUSIVITY — at most one of `isAsyncFunction`,
 *      `isGeneratorFunction`, `isAsyncGeneratorFunction` admits any value. They are
 *      distinct intrinsics; an async generator is NOT an async function.
 *   F. THE COROUTINE FAMILIES ARE NOT NEWABLE — `isAsyncFunction ∨
 *      isAnyGeneratorFunction ⇒ !hasConstructSlot`, hence never `isNewableFunction`,
 *      `isES3Function` or `isClass`. The construct-slot probe is the unspoofable
 *      discriminator, so this law crosses the whole lattice.
 *   G. CROSS-REALM VERDICT SYMMETRY — an untampered foreign callable scores
 *      identically to its local twin across the whole 12-predicate public surface.
 *      The family predicates carry explicit alien-realm arms (`isAlienRealm*`) for
 *      exactly this reason; no verdict may turn on realm membership alone.
 *   H. DETERMINISM — repeated calls on the same value agree (no hidden state, no
 *      caching across calls — the #059 resolve-once-and-thread posture).
 *   I. THE LATTICE DOES NOT COLLAPSE — witnesses that each arm is inhabited and
 *      distinguishable, so the laws above are not vacuously satisfied.
 *
 * Some laws (B especially) currently mirror the shape of their implementation — the
 * arms ARE defined as `isClass && p` / `isClass && !p`. They are asserted anyway: the
 * oracle's job is to fail when a future reimplementation drifts from the relationship,
 * not to be independent of today's code. (The primitive suite's equivalent law was
 * killed by a one-line mutation, which is the point.)
 *
 * Throw-safety is the axis-5 concern — see `throw-safety.test.js`, which also owns the
 * 24-name marked-set completeness triple-lock. This suite assumes it and asserts the
 * relationships it does not.
 */

import { describe, it, expect } from 'vitest';

import {
  isCallable,
  isFunction,
  hasConstructSlot,
  isNewableFunction,
  isES3Function,
  isClass,
  isCustomClass,
  isBuiltInClass,
  isAsyncFunction,
  isGeneratorFunction,
  isAsyncGeneratorFunction,
  isAnyGeneratorFunction,
} from '#index';

import {
  plainFunction,
  namedFunction,
  functionExpression,
  arrowFunction,
  conciseMethod,
  boundPlain,
  customClass,
  customSubclass,
  arrayCtor,
  mapCtor,
  dateCtor,
  numberCtor,
  objectCtor,
  errorCtor,
  boundClass,
  symbolCtor,
  bigintCtor,
  mathMax,
  parseIntFn,
  asyncFunction,
  asyncArrow,
  asyncMethod,
  boundAsync,
  promiseReturningArrow,
  generatorFunction,
  generatorMethod,
  boundGenerator,
  asyncGeneratorFunction,
  asyncGeneratorMethod,
  boundAsyncGenerator,
  nullValue,
  undefinedValue,
  primString,
  primNumber,
  primBoolean,
  primSymbol,
  primBigInt,
  plainObject,
  arrayValue,
  dateInstance,
  regExp,
  nullProtoObject,
  nonCallableWithMethods,
  foreignAsyncFunction,
  foreignGeneratorFunction,
  foreignAsyncGeneratorFunction,
  foreignPlainFunction,
  foreignArrowFunction,
  foreignClass,
  tagSpoofAsyncFunction,
  tagSpoofGeneratorFunction,
  arrowWithSpoofedPrototype,
  shadowedBindFunction,
  classWithTamperedInstanceToString,
  throwSafetyMatrix,
} from './__config.js';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  The lattice under test
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The complete 12-predicate public surface — the scoring vector for the cross-realm
 * symmetry law (G), the determinism law (H) and the callability floor (A).
 *
 * @type {Array<[string, (v: unknown) => boolean]>}
 */
const publicPredicates = [
  ['isCallable', isCallable],
  ['isFunction', isFunction],
  ['hasConstructSlot', hasConstructSlot],
  ['isNewableFunction', isNewableFunction],
  ['isES3Function', isES3Function],
  ['isClass', isClass],
  ['isCustomClass', isCustomClass],
  ['isBuiltInClass', isBuiltInClass],
  ['isAsyncFunction', isAsyncFunction],
  ['isGeneratorFunction', isGeneratorFunction],
  ['isAsyncGeneratorFunction', isAsyncGeneratorFunction],
  ['isAnyGeneratorFunction', isAnyGeneratorFunction],
];

// Predicates that refine `isFunction` — everything except the floor itself and the
// raw slot probe (`hasConstructSlot` answers about [[Construct]] alone, and is
// deliberately NOT gated on the bind/call/apply surface).
/** @type {Array<[string, (v: unknown) => boolean]>} */
const belowTheFloor = publicPredicates.filter(
  ([name]) =>
    name !== 'isCallable' && name !== 'isFunction' && name !== 'hasConstructSlot',
);

// The full corpus — every candidate class the module discriminates, plus foreign,
// adversarial and throwing values. A law that held only for well-formed callables
// would not be a law.
/** @type {Array<[string, () => unknown]>} */
const corpus = [
  ['plainFunction', plainFunction],
  ['namedFunction', namedFunction],
  ['functionExpression', functionExpression],
  ['arrowFunction', arrowFunction],
  ['conciseMethod', conciseMethod],
  ['boundPlain', boundPlain],
  ['customClass', customClass],
  ['customSubclass', customSubclass],
  ['arrayCtor', arrayCtor],
  ['mapCtor', mapCtor],
  ['dateCtor', dateCtor],
  ['numberCtor', numberCtor],
  ['objectCtor', objectCtor],
  ['errorCtor', errorCtor],
  ['boundClass', boundClass],
  ['symbolCtor', symbolCtor],
  ['bigintCtor', bigintCtor],
  ['mathMax', mathMax],
  ['parseIntFn', parseIntFn],
  ['asyncFunction', asyncFunction],
  ['asyncArrow', asyncArrow],
  ['asyncMethod', asyncMethod],
  ['boundAsync', boundAsync],
  ['promiseReturningArrow', promiseReturningArrow],
  ['generatorFunction', generatorFunction],
  ['generatorMethod', generatorMethod],
  ['boundGenerator', boundGenerator],
  ['asyncGeneratorFunction', asyncGeneratorFunction],
  ['asyncGeneratorMethod', asyncGeneratorMethod],
  ['boundAsyncGenerator', boundAsyncGenerator],
  ['nullValue', nullValue],
  ['undefinedValue', undefinedValue],
  ['primString', primString],
  ['primNumber', primNumber],
  ['primBoolean', primBoolean],
  ['primSymbol', primSymbol],
  ['primBigInt', primBigInt],
  ['plainObject', plainObject],
  ['arrayValue', arrayValue],
  ['dateInstance', dateInstance],
  ['regExp', regExp],
  ['nullProtoObject', nullProtoObject],
  ['nonCallableWithMethods', nonCallableWithMethods],
  ['foreignAsyncFunction', foreignAsyncFunction],
  ['foreignGeneratorFunction', foreignGeneratorFunction],
  ['foreignAsyncGeneratorFunction', foreignAsyncGeneratorFunction],
  ['foreignPlainFunction', foreignPlainFunction],
  ['foreignArrowFunction', foreignArrowFunction],
  ['foreignClass', foreignClass],
  ['tagSpoofAsyncFunction', tagSpoofAsyncFunction],
  ['tagSpoofGeneratorFunction', tagSpoofGeneratorFunction],
  ['arrowWithSpoofedPrototype', arrowWithSpoofedPrototype],
  ['shadowedBindFunction', shadowedBindFunction],
  ['classWithTamperedInstanceToString', classWithTamperedInstanceToString],
  ...Object.entries(throwSafetyMatrix).map(
    /** @returns {[string, () => unknown]} the labelled hostile-value row */
    ([key, row]) => [`hostile:${key}`, row.make],
  ),
];

describe('function — structural invariants (A: the callability floor)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: every public predicate ⇒ isCallable`, () => {
      const v = make();
      for (const [name, predicate] of publicPredicates) {
        expect(!predicate(v) || isCallable(v), `${name} admitted a non-callable`).toBe(
          true,
        );
      }
    });

    it(`${label}: every refinement below the floor ⇒ isFunction`, () => {
      const v = make();
      for (const [name, predicate] of belowTheFloor) {
        expect(!predicate(v) || isFunction(v), `${name} admitted a non-function`).toBe(
          true,
        );
      }
    });
  }
});

describe('function — structural invariants (B: the isClass partition)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: isClass === isCustomClass || isBuiltInClass`, () => {
      const v = make();
      expect(isClass(v)).toBe(isCustomClass(v) || isBuiltInClass(v));
    });

    it(`${label}: the two class arms are disjoint`, () => {
      const v = make();
      expect(isCustomClass(v) && isBuiltInClass(v)).toBe(false);
    });
  }
});

describe('function — structural invariants (C: the newable ladder)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: isNewableFunction === isFunction && hasConstructSlot`, () => {
      const v = make();
      expect(isNewableFunction(v)).toBe(isFunction(v) && hasConstructSlot(v));
    });

    it(`${label}: isES3Function ⇒ isNewableFunction, isClass ⇒ isNewableFunction`, () => {
      const v = make();
      expect(!isES3Function(v) || isNewableFunction(v), 'ES3 but not newable').toBe(true);
      expect(!isClass(v) || isNewableFunction(v), 'class but not newable').toBe(true);
    });

    it(`${label}: isES3Function and isClass are disjoint (prototype writability)`, () => {
      const v = make();
      expect(isES3Function(v) && isClass(v)).toBe(false);
    });
  }
});

describe('function — structural invariants (D: the generator umbrella)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: isAnyGeneratorFunction === sync || async generator`, () => {
      const v = make();
      expect(isAnyGeneratorFunction(v)).toBe(
        isGeneratorFunction(v) || isAsyncGeneratorFunction(v),
      );
    });

    it(`${label}: the two generator arms are disjoint`, () => {
      const v = make();
      expect(isGeneratorFunction(v) && isAsyncGeneratorFunction(v)).toBe(false);
    });
  }
});

describe('function — structural invariants (E: async/generator exclusivity)', () => {
  /** @type {Array<[string, (v: unknown) => boolean]>} */
  const coroutineFamilies = [
    ['isAsyncFunction', isAsyncFunction],
    ['isGeneratorFunction', isGeneratorFunction],
    ['isAsyncGeneratorFunction', isAsyncGeneratorFunction],
  ];

  for (const [label, make] of corpus) {
    it(`${label}: at most one coroutine family admits it`, () => {
      const v = make();
      const admitting = coroutineFamilies
        .filter(([, predicate]) => predicate(v))
        .map(([name]) => name);
      expect(
        admitting.length,
        `admitted by ${admitting.join(' + ')}`,
      ).toBeLessThanOrEqual(1);
    });
  }
});

describe('function — structural invariants (F: the coroutine families are not newable)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: async/generator ⇒ no [[Construct]] slot`, () => {
      const v = make();
      const isCoroutine = isAsyncFunction(v) || isAnyGeneratorFunction(v);
      expect(
        !isCoroutine || !hasConstructSlot(v),
        'coroutine with a construct slot',
      ).toBe(true);
      expect(!isCoroutine || !isNewableFunction(v), 'coroutine that is newable').toBe(
        true,
      );
      expect(!isCoroutine || !isClass(v), 'coroutine classified as a class').toBe(true);
      expect(!isCoroutine || !isES3Function(v), 'coroutine classified as ES3').toBe(true);
    });
  }
});

describe('function — structural invariants (G: cross-realm verdict symmetry)', () => {
  /** @type {Array<[string, () => unknown, () => unknown]>} */
  const realmPairs = [
    ['async function', asyncFunction, foreignAsyncFunction],
    ['generator function', generatorFunction, foreignGeneratorFunction],
    ['async generator function', asyncGeneratorFunction, foreignAsyncGeneratorFunction],
    ['plain function', plainFunction, foreignPlainFunction],
    ['arrow function', arrowFunction, foreignArrowFunction],
    ['class', customClass, foreignClass],
  ];

  /**
   * Score a value across the whole public surface.
   * @param {unknown} v - the value to score
   * @returns {Record<string, boolean>} predicate name → verdict
   */
  const scoreAll = (v) =>
    Object.fromEntries(publicPredicates.map(([name, predicate]) => [name, predicate(v)]));

  for (const [label, local, foreign] of realmPairs) {
    it(`${label}: the foreign value scores identically to the local twin (12 predicates)`, () => {
      expect(scoreAll(foreign())).toEqual(scoreAll(local()));
    });
  }
});

describe('function — structural invariants (H: determinism)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: every public predicate agrees with itself on a repeated call`, () => {
      const v = make();
      for (const [name, predicate] of publicPredicates) {
        expect(predicate(v), `${name} disagreed with itself`).toBe(predicate(v));
      }
    });
  }
});

describe('function — structural invariants (I: the lattice does not collapse)', () => {
  it('a custom class is custom, not built-in', () => {
    const v = customClass();
    expect(isClass(v), 'isClass').toBe(true);
    expect(isCustomClass(v), 'isCustomClass').toBe(true);
    expect(isBuiltInClass(v), 'isBuiltInClass').toBe(false);
  });

  it('a built-in constructor is built-in, not custom', () => {
    const v = mapCtor();
    expect(isClass(v), 'isClass').toBe(true);
    expect(isBuiltInClass(v), 'isBuiltInClass').toBe(true);
    expect(isCustomClass(v), 'isCustomClass').toBe(false);
  });

  it('an ES3 function is newable but not a class', () => {
    const v = plainFunction();
    expect(isES3Function(v), 'isES3Function').toBe(true);
    expect(isNewableFunction(v), 'isNewableFunction').toBe(true);
    expect(isClass(v), 'not a class').toBe(false);
  });

  it('an arrow function is a function but not newable', () => {
    const v = arrowFunction();
    expect(isFunction(v), 'isFunction').toBe(true);
    expect(hasConstructSlot(v), 'no construct slot').toBe(false);
    expect(isNewableFunction(v), 'not newable').toBe(false);
  });

  it('each coroutine family is inhabited and distinct', () => {
    const async = asyncFunction();
    const generator = generatorFunction();
    const asyncGenerator = asyncGeneratorFunction();

    expect(isAsyncFunction(async), 'async is async').toBe(true);
    expect(isAnyGeneratorFunction(async), 'async is no generator').toBe(false);

    expect(isGeneratorFunction(generator), 'generator is a generator').toBe(true);
    expect(isAsyncFunction(generator), 'generator is not async').toBe(false);

    expect(
      isAsyncGeneratorFunction(asyncGenerator),
      'async generator is an async generator',
    ).toBe(true);
    expect(isGeneratorFunction(asyncGenerator), 'not a sync generator').toBe(false);
    expect(isAsyncFunction(asyncGenerator), 'not a plain async function').toBe(false);
    expect(isAnyGeneratorFunction(asyncGenerator), 'under the umbrella').toBe(true);
  });

  it('a non-callable object is rejected by the whole surface', () => {
    const v = nonCallableWithMethods();
    for (const [name, predicate] of publicPredicates) {
      expect(predicate(v), `${name} admitted a non-callable object`).toBe(false);
    }
  });
});

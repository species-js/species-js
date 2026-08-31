// @ts-check

/**
 * @module test/object/spec
 *
 * Axis 1 — spec/contract, matrix-driven. Drives the `specMatrix` from
 * `__config.js`: every clean candidate scored against all four predicates
 * (`isObject`, `isPlainObject`, `isDictionaryObject`,
 * `isPlainOrDictionaryObject`), plus the cross-cutting rejection inputs. A
 * completeness guard fails if any matrix row omits a predicate column, so no
 * assertion can silently go missing. If a test here fails, the implementation
 * is wrong, not the test.
 *
 * Spoof / tampered-constructor / accessor boundaries live in
 * `adversarial.test.js`; foreign-realm in `cross-realm.test.js`; the `@internal`
 * helpers in `_internal/helpers.test.js`.
 *
 * `isObjectOrCallable` stands apart from the four-predicate `AnyObject` lineage
 * (it admits functions, which the matrix's `CC/function` group rejects for all
 * four), so it is scored in its own dedicated `describe` block below rather than
 * as a fifth `specMatrix` column.
 *
 * Mirrors `docs/spec/OBJECT.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import {
  isObject,
  isPlainObject,
  isDictionaryObject,
  isPlainOrDictionaryObject,
  isObjectOrCallable,
} from '#index';

import {
  specMatrix,
  crossCuttingRejections,
  emptyObject,
  array,
  nullProtoObject,
  classInstance,
  boxedString,
} from './__config.js';

/** @type {Record<string, (value?: unknown) => boolean>} */
const predicates = {
  isObject,
  isPlainObject,
  isDictionaryObject,
  isPlainOrDictionaryObject,
};
const predicateNames = Object.keys(predicates).sort();

describe('object — spec/contract matrix', () => {
  it('completeness: every matrix row scores every predicate', () => {
    for (const [key, row] of Object.entries(specMatrix)) {
      expect(Object.keys(row.expected).sort(), `row "${key}"`).toEqual(predicateNames);
    }
  });

  for (const [key, { description, make, expected, vectors }] of Object.entries(
    specMatrix,
  )) {
    describe(`${description} (${key})`, () => {
      for (const [predName, want] of Object.entries(expected)) {
        const vectorId = vectors.find((v) => v.startsWith(`${predName}/`)) ?? key;
        it(`${predName} → ${String(want)} [${vectorId}]`, () => {
          const predicate = predicates[predName];
          if (!predicate) {
            throw new Error(`no predicate "${predName}"`);
          }
          expect(predicate(make())).toBe(want);
        });
      }
    });
  }

  describe('cross-cutting rejections — all four predicates → false (incl. isObject/R1)', () => {
    for (const [group, values] of Object.entries(crossCuttingRejections)) {
      it(`CC/${group}`, () => {
        for (const value of values) {
          for (const predName of predicateNames) {
            const predicate = predicates[predName];
            if (!predicate) {
              throw new Error(`no predicate "${predName}"`);
            }
            expect(predicate(value), `${predName}(${String(value)})`).toBe(false);
          }
        }
      });
    }

    it('omitted argument → false', () => {
      expect(isObject()).toBe(false);
      expect(isPlainObject()).toBe(false);
      expect(isDictionaryObject()).toBe(false);
      expect(isPlainOrDictionaryObject()).toBe(false);
    });
  });
});

// `isObjectOrCallable` stands apart from the `AnyObject` lineage above (it admits
// functions, which every one of the four predicates rejects), so it is scored
// independently rather than added as a fifth column to `specMatrix` — see
// `docs/spec/OBJECT.spec.md` → `## isObjectOrCallable`.
describe('object — isObjectOrCallable (cross-module floor: AnyObject | Callable)', () => {
  describe('isObjectOrCallable/A1 — everything isObject/A1–A5 admits', () => {
    /** @type {Array<[string, () => unknown]>} */
    const admittedObjects = [
      ['emptyObject (plain)', emptyObject],
      ['array (container)', array],
      ['nullProtoObject (dictionary)', nullProtoObject],
      ['classInstance', classInstance],
      ['boxedString (boxed primitive)', boxedString],
    ];
    for (const [label, make] of admittedObjects) {
      it(`${label} → true`, () => {
        expect(isObjectOrCallable(make())).toBe(true);
      });
    }
  });

  describe('isObjectOrCallable/A2 — functions, the differentiator from the other four', () => {
    /** @type {Array<[string, unknown]>} */
    const functionForms = [
      ['arrow function', () => undefined],
      [
        'class',
        class Foo {
          run() {
            return 0;
          }
        },
      ],
      [
        'named function',
        function named() {
          return undefined;
        },
      ],
    ];
    for (const [label, fn] of functionForms) {
      it(`${label} → true`, () => {
        expect(isObjectOrCallable(fn)).toBe(true);
      });
    }
  });

  describe('isObjectOrCallable/R1 — nullish and primitive, still rejected', () => {
    for (const [group, values] of Object.entries(crossCuttingRejections)) {
      // the `function` group is ADMITTED here (A2 above) — every other group is
      // still rejected, same as the four `AnyObject`-lineage predicates.
      if (group === 'function') {
        continue;
      }
      it(`CC/${group}`, () => {
        for (const value of values) {
          expect(isObjectOrCallable(value), String(value)).toBe(false);
        }
      });
    }
  });

  it('omitted argument → false', () => {
    expect(isObjectOrCallable()).toBe(false);
  });
});

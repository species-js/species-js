// @ts-check

/**
 * @module test/throw-safety
 *
 * Axis 3 — the throwing surface, and the completeness oracle over it.
 *
 * The package keeps the workspace's universal invariant for its one predicate
 * and adds a stronger one for its two mutators, and the spec states them as two
 * rules rather than one:
 *
 * - `doesCarryStableTypeIdentity` answers `false` on every input, hostile ones
 *   included. It has no second channel, so an unreadable value is answered
 *   exactly as a value that simply lacks the shape.
 * - **Neither freezing entry ever throws.** Every refusal arrives as
 *   `{ success: false, reason }`, and `reason` is always an `Error` — a
 *   non-error throw being wrapped and carried as the wrapper's `cause`.
 *
 * Both rules cover the same hostile-input classes. What differs is the
 * reporting channel, not the exposure, which is why one matrix scores all three
 * entries per row.
 *
 * ## Why the oracle comes first
 *
 * Every assertion below is about an answer. None of them can see a marked
 * export arriving with no vectors behind it — the failure mode where the suite
 * stays green because it never learned there was something new to ask. The
 * first block is the only one that asks that question: the `@@throw-safe`
 * markers the two source dialects carry, against the set this file declares and
 * the set it actually scores.
 *
 * The two dialects are specified to DISAGREE here, and the oracle asserts the
 * disagreement rather than papering over it. The `.js` marks eleven
 * declarations, the `.d.ts` six: a marker is a promise about a function, and
 * the five module-local helpers the spec's surface inventory names do not stop
 * making it by staying local — they simply have no declaration to carry it in.
 *
 * Mirrors `docs/spec/TYPE-IDENTITY.spec.md` (FROZEN 2026-09-09) — "The throw
 * contract — two rules, not one".
 */

import { describe, it, expect } from 'vitest';

import {
  doesCarryStableTypeIdentity,
  getIdentifierAsSafeResult,
  isSupportedConstructor,
  resolveErrorWithCause,
} from '#index';
import { isNewableFunction } from '@species-js/type-detection';

import {
  THROW_SAFE_EXPORTS,
  THROW_SAFE_MODULE_LOCALS,
  callBrand,
  callDefine,
  hostileErrorConstructors,
  hostileIdentifiers,
  hostileTargetMatrix,
} from './__config.js';
import { arrowFunction, builtinArray, freshClass, freshES3 } from './__fixtures.js';
import { parseMarkedDeclarations } from './_source-oracles.js';

/** @typedef {import('@species-js/type-detection').NewableFunction} NewableFunction */

/** The entries scored against every hostile TARGET, by name. */
const entries = {
  defineStableTypeIdentity: (/** @type {unknown} */ value) =>
    callDefine([value, 'Hostile']),
  brandFunctionName: (/** @type {unknown} */ value) => callBrand([value, 'Hostile']),
};

/**
 * The marked exports this suite reaches, including the three whose declared
 * parameter type narrows which hostile values are even in contract for them.
 *
 * A marker promises totality WITHIN the declared type. Feeding
 * `getIdentifierAsSafeResult` a hostile constructor, or `isSupportedConstructor`
 * a value that is not newable, would test nothing about the marker and report a
 * defect that is not one — so each of the three gets the hostile group its own
 * signature admits.
 */
const scored = [
  ...Object.keys(entries),
  'doesCarryStableTypeIdentity',
  'getIdentifierAsSafeResult',
  'isSupportedConstructor',
  'resolveErrorWithCause',
].sort();

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  The Completeness Oracle
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('type-identity — throw-safety: the completeness oracle', () => {
  it('the declared sets are non-empty and free of duplicates', () => {
    for (const declared of [THROW_SAFE_EXPORTS, THROW_SAFE_MODULE_LOCALS]) {
      expect(declared.length).toBeGreaterThan(0);
      expect(new Set(declared).size).toBe(declared.length);
    }
  });

  it('the markers on `src/index.js`’s EXPORTS === the declared set', () => {
    expect(parseMarkedDeclarations('index.js').exported).toEqual(
      [...THROW_SAFE_EXPORTS].sort(),
    );
  });

  it('the markers on `src/index.d.ts`’s exports === the declared set', () => {
    expect(parseMarkedDeclarations('index.d.ts').exported).toEqual(
      [...THROW_SAFE_EXPORTS].sort(),
    );
  });

  it('the `.js` also marks the five module-local helpers the spec inventories', () => {
    expect(parseMarkedDeclarations('index.js').internal).toEqual(
      [...THROW_SAFE_MODULE_LOCALS].sort(),
    );
  });

  it('the `.d.ts` marks none of them — it has no declaration to carry one', () => {
    expect(parseMarkedDeclarations('index.d.ts').internal).toEqual([]);
  });

  it('the set this suite scores === the declared set', () => {
    expect(scored).toEqual([...THROW_SAFE_EXPORTS].sort());
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Hostile Targets
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('type-identity — throw-safety: hostile targets', () => {
  const columns = [...Object.keys(entries), 'doesCarryStableTypeIdentity'].sort();

  it('completeness: every hostile row scores every entry', () => {
    expect(Object.keys(hostileTargetMatrix).length).toBeGreaterThan(0);

    for (const [key, row] of Object.entries(hostileTargetMatrix)) {
      expect(Object.keys(row.expected).sort(), `row "${key}"`).toEqual(columns);
    }
  });

  it('the matrix is not satisfiable by a constant — it carries both verdicts', () => {
    const outcomes = new Set(
      Object.values(hostileTargetMatrix).flatMap((row) => Object.values(row.expected)),
    );

    expect(outcomes).toEqual(new Set([true, false]));
  });

  for (const [key, row] of Object.entries(hostileTargetMatrix)) {
    describe(`${row.description} (${key})`, () => {
      for (const [entryName, expected] of Object.entries(entries)) {
        it(`${entryName} returns, and reports success ${String(row.expected[/** @type {'defineStableTypeIdentity' | 'brandFunctionName'} */ (entryName)])}`, () => {
          const value = row.make();
          /** @type {import('#index').IdentityDefinitionResult | undefined} */
          let result;

          expect(() => {
            result = expected(value);
          }, `${entryName} threw`).not.toThrow();

          const settled = result;

          if (settled === undefined) {
            throw new Error(`${entryName} produced no result at all`);
          }
          expect(settled.success).toBe(
            row.expected[
              /** @type {'defineStableTypeIdentity' | 'brandFunctionName'} */ (entryName)
            ],
          );

          if (!settled.success) {
            expect(settled.reason, 'a reason is ALWAYS an error').toBeInstanceOf(Error);
          }
        });
      }

      it(`doesCarryStableTypeIdentity returns ${String(row.expected.doesCarryStableTypeIdentity)}`, () => {
        const value = row.make();

        expect(() => doesCarryStableTypeIdentity(value)).not.toThrow();
        expect(doesCarryStableTypeIdentity(value)).toBe(
          row.expected.doesCarryStableTypeIdentity,
        );
      });
    });
  }
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Hostile Identifiers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('type-identity — throw-safety: hostile identifiers', () => {
  const identifiers = hostileIdentifiers();

  it('the group is non-empty and covers both rejection classes', () => {
    const classes = new Set(Object.values(identifiers).map((row) => row.errorClass));

    expect(Object.keys(identifiers).length).toBeGreaterThan(0);
    expect(classes).toEqual(new Set([TypeError, RangeError]));
  });

  for (const [key, row] of Object.entries(identifiers)) {
    describe(`${row.description} (${key})`, () => {
      it('getIdentifierAsSafeResult reports it rather than throwing', () => {
        expect(() => getIdentifierAsSafeResult(row.make(), 'probe')).not.toThrow();
        expect(getIdentifierAsSafeResult(row.make(), 'probe').error?.constructor).toBe(
          row.errorClass,
        );
      });

      it('as `constructorName`, the freezing entry reports it rather than throwing', () => {
        /** @type {import('#index').IdentityDefinitionResult | undefined} */
        let result;

        expect(() => {
          result = callDefine([freshClass(), row.make()]);
        }).not.toThrow();
        expect(result?.success).toBe(false);
      });

      it('as `taggedType`, the freezing entry reports it rather than throwing', () => {
        /** @type {import('#index').IdentityDefinitionResult | undefined} */
        let result;

        expect(() => {
          result = callDefine([freshClass(), 'Fine', row.make()]);
        }).not.toThrow();
        expect(result?.success).toBe(false);
      });

      it('as `fctName`, the branding entry reports it rather than throwing', () => {
        /** @type {import('#index').IdentityDefinitionResult | undefined} */
        let result;

        expect(() => {
          result = callBrand([arrowFunction(), row.make()]);
        }).not.toThrow();
        expect(result?.success).toBe(false);
      });
    });
  }
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  The Two Narrowed Helpers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('type-identity — throw-safety: the narrowed helpers', () => {
  it('isSupportedConstructor answers every NEWABLE hostile, and answers both ways', () => {
    const newableHostiles = Object.entries(hostileTargetMatrix)
      .map(([key, row]) => ({ key, value: row.make() }))
      .filter(({ value }) => isNewableFunction(value));

    expect(
      newableHostiles.length,
      'no hostile row is newable, so this block would assert nothing',
    ).toBeGreaterThan(0);

    for (const { key, value } of newableHostiles) {
      expect(() =>
        isSupportedConstructor(/** @type {NewableFunction} */ (value)),
      ).not.toThrow();
      expect(
        typeof isSupportedConstructor(/** @type {NewableFunction} */ (value)),
        key,
      ).toBe('boolean');
    }

    // the controls, so "answers" cannot be satisfied by a constant
    expect(isSupportedConstructor(freshES3())).toBe(true);
    expect(isSupportedConstructor(builtinArray())).toBe(false);
  });

  it('resolveErrorWithCause survives a constructor that refuses to be probed', () => {
    const constructors = hostileErrorConstructors();

    expect(Object.keys(constructors).length).toBeGreaterThan(0);

    for (const [key, row] of Object.entries(constructors)) {
      const provided = /** @type {ErrorConstructor} */ (row.make());

      expect(() => resolveErrorWithCause(provided), key).not.toThrow();
      expect(
        resolveErrorWithCause(provided),
        `${key} — a refusing probe selects the stand-in`,
      ).not.toBe(provided);
    }

    // the control: a constructor that DOES honor the bag is handed back, so the
    // block above cannot pass against a seam that always builds a stand-in
    expect(resolveErrorWithCause(Error)).toBe(Error);
  });
});

// @ts-check

/**
 * @module test/helpers
 *
 * Axis 4 — the three exported `@internal` values and the realm-fixed captures.
 * Dimensions E and the `cap/*` half of F in
 * `docs/spec/TYPE-IDENTITY.spec.md` (FROZEN 2026-09-09).
 *
 * These are reachable through the public entries, but only along the paths the
 * entries happen to take. Three things are reachable nowhere else and are the
 * reason this suite exists:
 *
 * 1. the identifier gate's answer as a VALUE — the entries consume the
 *    normalized string and never hand it back, so `ident/A2`'s trim and
 *    `ident/A3`'s unwrap are otherwise observable only as a side effect;
 * 2. the shape gate OUTSIDE its precondition (`shape/B2`), which the freezing
 *    entry cannot reach, condition 1 having gated it;
 * 3. the error-cause seam's fallback arm, which is dead code on every engine
 *    whose native `Error` already honors the options bag — that is, on every
 *    engine this package is developed on.
 *
 * ## The identifier matrix is driven four ways
 *
 * `getIdentifierAsSafeResult` serves `constructorName`, `taggedType` and
 * `fctName`, and the source says the single `parameterName` argument is what
 * keeps each rejection naming the parameter its caller passed. That is a claim
 * about all three consumers, not about the helper, so one matrix is driven
 * against the helper AND through each of the three parameters, and a law
 * compares the four verdicts. Asserting it once per consumer by hand would
 * leave the sameness itself unasserted.
 */

import { describe, it, expect } from 'vitest';

import { readFileSync } from 'node:fs';

import {
  getIdentifierAsSafeResult,
  isSupportedConstructor,
  resolveErrorWithCause,
} from '#index';
import { isNewableFunction } from '@species-js/type-detection';
import * as configModule from '#config';
import {
  defineProperty,
  getOwnPropertyDescriptor,
  getPrototypeOf,
  globalContext,
} from '#config';

import {
  callBrand,
  callDefine,
  identifierMatrix,
  shapeMatrix,
  shapeSentinelInputs,
} from './__config.js';
import {
  IgnoringError,
  ThrowingError,
  arrowFunction,
  causeOptionBags,
  descriptorTrapThrowingProxy,
  freshClass,
  freshES3,
  instantiate,
  ownDescriptorOf,
  prototypeOf,
} from './__fixtures.js';

/** @typedef {import('@species-js/type-detection').NewableFunction} NewableFunction */

/**
 * `Error` in its ES2022 two-argument form.
 *
 * The cast is not a convenience. The workspace compiles against an ES2020 lib —
 * the package's declared floor — so the options bag is not in the `Error`
 * signature TypeScript sees at all. That gap IS the seam's subject: the
 * two-argument form parses on every engine, support cannot be inferred from
 * syntax, and the package probes the observable effect instead. Reaching the
 * native form here therefore takes the same acknowledgement a caller on an
 * older engine would need.
 *
 * @type {new (message?: string, options?: { cause?: unknown }) => Error & { cause?: unknown }}
 */
const NativeErrorWithCause = /** @type {never} */ (Error);

/**
 * @typedef {object} IdentifierOutcome
 * @property {unknown} errorClass - the rejection's class, or `null` when admitted
 * @property {string | null} message - the rejection's message, or `null`
 * @property {string | null} value - the normalized identifier as the consumer observes it
 */

/**
 * The tag a frozen constructor answers, read from the installed getter rather
 * than from `Object.prototype.toString`.
 *
 * The brand string would have to be parsed back out of `[object …]`, and two of
 * the accepted identifiers contain whitespace the parse would have to preserve.
 * The getter returns the tag itself.
 *
 * @param {NewableFunction} constructor - a frozen constructor
 * @returns {string} the tag it answers
 */
const installedTagOf = (constructor) => {
  const getter = /** @type {() => unknown} */ (
    ownDescriptorOf(prototypeOf(constructor), Symbol.toStringTag)?.get
  );

  return /** @type {string} */ (getter());
};

/**
 * The four ways the identifier gate is reached, each normalized to one outcome
 * shape so a single assertion body serves all of them.
 *
 * @type {Record<string, { parameterName: string, run: (candidate: unknown) => IdentifierOutcome }>}
 */
const identifierDrives = {
  getIdentifierAsSafeResult: {
    parameterName: 'probe',
    run: (candidate) => {
      const result = getIdentifierAsSafeResult(candidate, 'probe');

      return result.error === null
        ? { errorClass: null, message: null, value: result.value }
        : {
            errorClass: result.error.constructor,
            message: result.error.message,
            value: null,
          };
    },
  },
  constructorName: {
    parameterName: 'constructorName',
    run: (candidate) => {
      const C = freshClass();
      const result = callDefine([C, candidate]);

      return result.success
        ? { errorClass: null, message: null, value: C.name }
        : {
            errorClass: result.reason.constructor,
            message: result.reason.message,
            value: null,
          };
    },
  },
  taggedType: {
    parameterName: 'taggedType',
    run: (candidate) => {
      const C = freshClass();
      const result = callDefine([C, 'Fixed', candidate]);

      return result.success
        ? { errorClass: null, message: null, value: installedTagOf(C) }
        : {
            errorClass: result.reason.constructor,
            message: result.reason.message,
            value: null,
          };
    },
  },
  fctName: {
    parameterName: 'fctName',
    run: (candidate) => {
      const fct = arrowFunction();
      const result = callBrand([fct, candidate]);

      return result.success
        ? { errorClass: null, message: null, value: fct.name }
        : {
            errorClass: result.reason.constructor,
            message: result.reason.message,
            value: null,
          };
    },
  },
};

/**
 * The message a rejection of a given class must carry, for a given parameter.
 *
 * Written out here rather than imported from the source, for the reason the
 * condition maps are: an oracle that reads the value it checks cannot detect a
 * change to it.
 *
 * @param {unknown} errorClass - the rejection's class
 * @param {string} parameterName - the parameter the caller passed
 * @returns {string} the message
 */
const identifierMessageFor = (errorClass, parameterName) =>
  errorClass === RangeError
    ? `Invalid string value passed as "${parameterName}".`
    : `The provided "${parameterName}" parameter needs to be a string.`;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  E — The Identifier Gate
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('type-identity spec — E: the identifier gate (ident/*)', () => {
  it('the matrix is non-empty and scores all three outcomes', () => {
    const classes = new Set(Object.values(identifierMatrix).map((row) => row.errorClass));

    expect(Object.keys(identifierMatrix).length).toBeGreaterThan(0);
    expect(classes, 'admitted, wrong TYPE, degenerate VALUE').toEqual(
      new Set([null, TypeError, RangeError]),
    );
  });

  for (const [driveName, drive] of Object.entries(identifierDrives)) {
    describe(`through \`${driveName}\``, () => {
      for (const [key, row] of Object.entries(identifierMatrix)) {
        const outcome = row.errorClass === null ? `→ ${String(row.value)}` : 'rejected';

        it(`${row.description} ${outcome} [${row.vectors.join(', ')}]`, () => {
          const observed = drive.run(row.make());
          const label = `${driveName}/${key}`;

          expect(observed.errorClass, `${label} — the class`).toBe(row.errorClass);

          if (row.errorClass === null) {
            expect(observed.value, `${label} — the normalized identifier`).toBe(
              row.value,
            );
          } else {
            expect(observed.message, `${label} — the message`).toBe(
              identifierMessageFor(row.errorClass, drive.parameterName),
            );
          }
        });
      }
    });
  }

  it('ident/A3 — the unwrap yields a primitive, not a wrapper written into a slot', () => {
    const result = getIdentifierAsSafeResult(new String(' Foo '), 'probe');

    expect(result.error).toBeNull();
    expect(typeof result.value).toBe('string');
    expect(result.value).toBe('Foo');
  });

  it('ident/B2 — a bad TYPE and a degenerate VALUE are told apart by their class', () => {
    expect(getIdentifierAsSafeResult(42, 'probe').error?.constructor).toBe(TypeError);
    expect(getIdentifierAsSafeResult('', 'probe').error?.constructor).toBe(RangeError);
  });

  it('ident/B1 — a hostile identifier is refused before any coercion is attempted', () => {
    // the type check runs first, which is what keeps the entries' "never
    // throws" true: every coercion path on this value throws
    const hostile = new Proxy(new String('Foo'), {
      get: () => () => {
        throw new TypeError('every coercion path refuses');
      },
    });

    expect(() => getIdentifierAsSafeResult(hostile, 'probe')).not.toThrow();
    expect(getIdentifierAsSafeResult(hostile, 'probe').error?.constructor).toBe(
      TypeError,
    );
    expect(() => String(hostile), 'the value really is hostile').toThrow(TypeError);
  });

  it('the four consumers agree on every candidate — one gate, three parameters', () => {
    const drives = Object.values(identifierDrives);

    expect(drives.length).toBe(4);

    for (const [key, row] of Object.entries(identifierMatrix)) {
      const classes = drives.map((drive) => drive.run(row.make()).errorClass);

      expect(new Set(classes).size, `"${key}" is judged differently somewhere`).toBe(1);
    }
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  E — The Shape Gate
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('type-identity spec — E: the shape gate (shape/*)', () => {
  it('the matrix is non-empty and scores both verdicts', () => {
    const verdicts = new Set(Object.values(shapeMatrix).map((row) => row.expected));

    expect(Object.keys(shapeMatrix).length).toBeGreaterThan(0);
    expect(verdicts).toEqual(new Set([true, false]));
  });

  for (const [key, row] of Object.entries(shapeMatrix)) {
    it(`${row.description} → ${String(row.expected)} [${row.vectors.join(', ')}]`, () => {
      const candidate = row.make();

      expect(
        isNewableFunction(candidate),
        `${key} — the row's own precondition claim`,
      ).toBe(row.withinPrecondition);

      // the cast is the precondition, stated the way `type/T10` says a typed
      // caller must: narrow with `isNewableFunction` first. The one row that
      // does NOT narrow is the one the spec puts outside the precondition, and
      // it is the reason this cast is written rather than a guard.
      expect(
        isSupportedConstructor(/** @type {NewableFunction} */ (candidate)),
        key,
      ).toBe(row.expected);
    });
  }

  it('shape/B2 — outside the precondition the answer is a sentinel, not a claim', () => {
    const sentinels = shapeSentinelInputs();

    expect(Object.keys(sentinels).length).toBeGreaterThan(0);

    for (const [key, make] of Object.entries(sentinels)) {
      const candidate = make();

      expect(isNewableFunction(candidate), `${key} — none of these is newable`).toBe(
        false,
      );
      expect(
        isSupportedConstructor(/** @type {NewableFunction} */ (candidate)),
        key,
      ).toBe(false);
    }
  });

  it('shape/B2 — the entry never reaches the predicate in that state', () => {
    // the arrow with a grafted `prototype` answers the gate `true`, and the
    // entry still refuses it — at condition 1, which runs first
    const result = callDefine([
      /** @type {unknown} */ (
        (() => {
          const arrow = arrowFunction();

          defineProperty(arrow, 'prototype', {
            value: {},
            writable: true,
            configurable: true,
          });

          return arrow;
        })()
      ),
      'Foo',
    ]);

    expect(result.success).toBe(false);
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  E — The Error-Cause Seam
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('type-identity spec — E: the error-cause seam (cause/*)', () => {
  const asErrorConstructor = (/** @type {unknown} */ value) =>
    /** @type {ErrorConstructor} */ (value);

  it('cause/A1 — a native `Error` that honors the bag is handed back by IDENTITY', () => {
    expect(resolveErrorWithCause(Error)).toBe(Error);
  });

  it('cause/A2 — a constructor that ignores the second argument selects the stand-in', () => {
    expect(resolveErrorWithCause(asErrorConstructor(IgnoringError))).not.toBe(
      IgnoringError,
    );
  });

  it('cause/A3 — a constructor that THROWS when probed also selects the stand-in', () => {
    expect(() => resolveErrorWithCause(asErrorConstructor(ThrowingError))).not.toThrow();
    expect(resolveErrorWithCause(asErrorConstructor(ThrowingError))).not.toBe(
      ThrowingError,
    );
  });

  it('cause/A4 — the stand-in installs `cause` under the native descriptor, field for field', () => {
    const StandIn = resolveErrorWithCause(asErrorConstructor(IgnoringError));
    const standInError = new StandIn('m', { cause: 'reason' });
    const nativeError = new NativeErrorWithCause('m', { cause: 'reason' });

    expect(ownDescriptorOf(standInError, 'cause')).toEqual({
      value: 'reason',
      writable: true,
      enumerable: false,
      configurable: true,
    });
    expect(ownDescriptorOf(standInError, 'cause')).toEqual(
      ownDescriptorOf(nativeError, 'cause'),
    );
  });

  it('cause/A5 — presence, not truthiness', () => {
    const StandIn = resolveErrorWithCause(asErrorConstructor(IgnoringError));

    expect(ownDescriptorOf(new StandIn('m'), 'cause')).toBeNull();
    expect(ownDescriptorOf(new StandIn('m', { cause: undefined }), 'cause')).toEqual({
      value: undefined,
      writable: true,
      enumerable: false,
      configurable: true,
    });
  });

  it('cause/A6 — the stand-in’s product is an ordinary error of the provided type', () => {
    const StandIn = resolveErrorWithCause(asErrorConstructor(IgnoringError));
    const built = new StandIn('the message', { cause: 'reason' });

    expect(built).toBeInstanceOf(IgnoringError);
    expect(Object.prototype.toString.call(built)).toBe('[object Error]');
    expect(built.message).toBe('the message');

    const withoutNew = /** @type {(message?: string) => Error} */ (
      /** @type {unknown} */ (StandIn)
    )('called without new');

    expect(withoutNew).toBeInstanceOf(IgnoringError);
    expect(withoutNew.message).toBe('called without new');
  });

  describe('cause/B1 — the stand-in’s trigger is narrower than the native’s', () => {
    const bags = causeOptionBags();

    it('the bag set is non-empty and covers both the agreements and the divergences', () => {
      const shapes = new Set(
        Object.values(bags).map((bag) => `${String(bag.native)}/${String(bag.standIn)}`),
      );

      expect(Object.keys(bags).length).toBeGreaterThan(0);
      expect(shapes, 'a divergence set with no agreement in it proves nothing').toEqual(
        new Set(['true/true', 'true/false']),
      );
    });

    for (const [key, bag] of Object.entries(bags)) {
      it(`${bag.description} — native ${String(bag.native)}, stand-in ${String(bag.standIn)}`, () => {
        const StandIn = resolveErrorWithCause(asErrorConstructor(IgnoringError));
        const options = /** @type {{ cause?: unknown }} */ (bag.make());

        expect(
          Object.prototype.hasOwnProperty.call(
            new NativeErrorWithCause('m', options),
            'cause',
          ),
          `${key} — the native form`,
        ).toBe(bag.native);
        expect(
          Object.prototype.hasOwnProperty.call(new StandIn('m', options), 'cause'),
          `${key} — the stand-in`,
        ).toBe(bag.standIn);
      });
    }

    it('the two agree on the shape this package actually builds — an object literal', () => {
      const StandIn = resolveErrorWithCause(asErrorConstructor(IgnoringError));

      expect(ownDescriptorOf(new StandIn('m', { cause: 'reason' }), 'cause')?.value).toBe(
        'reason',
      );
      expect(new NativeErrorWithCause('m', { cause: 'reason' }).cause).toBe('reason');
    });
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  F — The Realm-Fixed Captures
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('type-identity spec — F: the realm-fixed captures (cap/*)', () => {
  it('cap/A1 — `#config` exports exactly the four captures', () => {
    expect(Object.keys(configModule).sort()).toEqual([
      'defineProperty',
      'getOwnPropertyDescriptor',
      'getPrototypeOf',
      'globalContext',
    ]);
  });

  it('cap/A1 — each capture is identity-equal to its intrinsic', () => {
    expect(globalContext).toBe(globalThis);
    expect(getPrototypeOf).toBe(Object.getPrototypeOf);
    expect(defineProperty).toBe(Object.defineProperty);
    expect(getOwnPropertyDescriptor).toBe(Object.getOwnPropertyDescriptor);
  });

  it('cap/A1 — a post-load global `Object` cannot redirect what the package writes', () => {
    const realObject = globalThis.Object;
    const decoy = /** @type {ObjectConstructor} */ (
      /** @type {unknown} */ ({
        defineProperty: () => {
          throw new Error('the decoy was reached');
        },
        getOwnPropertyDescriptor: () => undefined,
        getPrototypeOf: () => null,
      })
    );
    const C = freshClass();

    // the swap is restored in the same synchronous block it is made in, so no
    // other code in this worker can observe the decoy. Nothing but the entry
    // runs inside that window — not even an assertion: `expect` reaches for
    // `Object` members of its own, and asserting in there measured the test
    // harness rather than the package.
    /** @type {{ Object: ObjectConstructor }} */ (globalThis).Object = decoy;

    /** @type {import('#index').IdentityDefinitionResult} */
    let result;

    try {
      result = callDefine([C, 'Captured']);
    } finally {
      /** @type {{ Object: ObjectConstructor }} */ (globalThis).Object = realObject;
    }

    expect(globalThis.Object, 'the realm was restored').toBe(realObject);
    expect(result.success).toBe(true);
    expect(C.name).toBe('Captured');
    expect(ownDescriptorOf(prototypeOf(C), 'constructor')?.value).toBe(C);
  });

  it('cap/A2 — `getOwnPropertyDescriptor` is the RAW capture, not a throw-safe one', () => {
    // the module-local reader is what separates conditions 8 and 9; the capture
    // itself has to stay honest for that reader to have anything to catch
    expect(() =>
      getOwnPropertyDescriptor(descriptorTrapThrowingProxy(), 'prototype'),
    ).toThrow(TypeError);
  });

  it('cap/A3 — `#config` is not a published subpath', () => {
    // `JSON.parse` answers `any`, so the hop through `unknown` is what keeps the
    // narrowing acknowledged — the same shape `vite.config.js` uses to read this
    // very file for its `private` gate.
    const manifest = /** @type {unknown} */ (
      JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    );
    const exportsMap =
      typeof manifest === 'object' && manifest !== null && 'exports' in manifest
        ? /** @type {object} */ (manifest.exports)
        : null;

    expect(exportsMap, 'the manifest declares no `exports` map at all').not.toBeNull();
    expect(Object.keys(/** @type {object} */ (exportsMap))).toEqual(['.']);
  });

  it('cap/A3 — the value-adds are imported rather than reproduced here', () => {
    // ADR #086's other half: a raw capture stays local, a preset comes from the
    // type-detection root. A copy of either here would be the drift the rule
    // exists to prevent.
    expect(configModule).not.toHaveProperty('frozenEntryDescriptor');
    expect(configModule).not.toHaveProperty('sealedEntryAccessor');
    expect(configModule).not.toHaveProperty('objectHasOwn');
  });

  it('the captures are the ones the entries actually use — a positive control', () => {
    const F = freshES3();

    expect(callDefine([F, 'Captured']).success).toBe(true);
    expect(getOwnPropertyDescriptor(prototypeOf(F), 'constructor')?.value).toBe(F);
    expect(getPrototypeOf(instantiate(F))).toBe(prototypeOf(F));
  });
});

// @ts-check

/**
 * @module test/error/__config
 *
 * Test configuration for the `error` module: the candidate value-universe
 * (fresh-value factories) plus the axis-1 contract matrix scoring each clean
 * candidate against all four public predicates — `isGenericError`,
 * `isDOMException`, `isError`, `isAbortError`. The matrix makes the disjoint
 * partition auditable at a glance:
 *
 *   isError = isGenericError (Error, not DOMException) ⊎ isDOMException (any DOMException)
 *   isAbortError refines isError by a `name`-suffix match.
 *
 * `spec.test.js` drives the matrix; the targeted axis suites (cross-realm,
 * adversarial, _internal, throw-safety) import the specific named factories they
 * need. Spoof / graft / boundary / hostile candidates are deliberately NOT in the
 * clean matrix — their rationale belongs in `adversarial.test.js` /
 * `throw-safety.test.js` prose, not a silent data row.
 *
 * Node note: Node 22 has no native `Error.isError`, so `isError` binds to the
 * `isAnyError` polyfill and V8 is stack-capable (`ERROR_STACK_CAPABLE === true`,
 * `errorStackMode === 'gated-slot'`). The graft-filter verdicts (`isError` /
 * `isGenericError` on `Object.create(Error.prototype)`) are asserted for that
 * regime; the non-stack-capable regime is a documented boundary.
 *
 * Mirrors `docs/spec/ERROR.spec.md`.
 */

import { objectCreate } from '@/index.js';

import { foreignRealmEval } from '../_cross-realm.js';

const domExceptionPrototype = DOMException.prototype;

// ----- clean candidate factories (fresh, genuine value per call) -----

export const plainError = () => new Error('boom');
export const typeError = () => new TypeError('x');
export const rangeError = () => new RangeError();
export const errorSubclassInstance = () => new (class extends Error {})();
// an Error subclass naming itself through a class field — Error OWNS its contract
// by design, so an own data `name` is not a tamper (isGenericError still true).
export const namedErrorSubclass = () =>
  new (class NamedError extends Error {
    /** @override */
    name = 'NamedError';
  })();

// a direct DOMException whose name is NOT an abort name.
export const domException = () => new DOMException('m', 'SyntaxError');
// a direct DOMException whose name IS `AbortError` — pins isAbortError/A1.
export const abortDomException = () => new DOMException('aborted', 'AbortError');
// an idiomatic DOMException subclass that keeps the getter-backed name via
// `super(message, name)` — admitted by isDOMException.
export const domExceptionSubclass = () =>
  new (class extends DOMException {
    constructor(m = 'm') {
      super(m, 'MyException');
    }
  })();

// an Error whose name ends with `AbortError` via a qualifier prefix (class field).
export const timeoutAbortError = () =>
  new (class TimeoutAbortError extends Error {
    /** @override */
    name = 'TimeoutAbortError';
  })();
// a real Error with an own `name` overridden to exactly `AbortError`.
export const errorNamedAbort = () => Object.assign(new Error(), { name: 'AbortError' });

// error-SHAPED but not an error: a plain object with string name/message.
export const plainErrorShaped = () => ({ name: 'Error', message: '' });

// ----- graft / boundary shapes (targeted by adversarial.test.js) -----

// a bare graft onto the real DOMException.prototype — never constructed, but its
// inherited name/message getters are PRESENT, and isDOMException reads presence
// (never invokes) → admitted. isDOMException/B1.
export const bareDomExceptionGraft = () => objectCreate(domExceptionPrototype);
// an own-GETTER `name` graft — a get-gated name is admitted wherever it lives.
// isDOMException/A3.
export const ownGetterNameGraft = () =>
  objectCreate(domExceptionPrototype, { name: { get: () => 'X', configurable: true } });
// an own-DATA `name` graft — a data descriptor shadows the inherited getter →
// rejected. isDOMException/R3.
export const ownDataNameGraft = () =>
  objectCreate(domExceptionPrototype, { name: { value: 'X', configurable: true } });
// an own-DATA `message` graft — symmetric on message. isDOMException/R4.
export const ownDataMessageGraft = () =>
  objectCreate(domExceptionPrototype, { message: { value: 'm', configurable: true } });
// a "Chrome stand-in": valid name/message getters but NO reachable stack. The
// DOMException contract is getter-shape (not stack), so it is admitted — the
// engine-independence that keeps isError(new DOMException()) true in a browser.
// isDOMException/A5, iAE/B1.
export const chromeStandInDomException = () =>
  objectCreate(domExceptionPrototype, {
    name: { get: () => 'X', configurable: true },
    message: { get: () => 'm', configurable: true },
  });
// a bare graft onto Error.prototype — instanceof Error but no reachable stack,
// so the graft filter rejects it in a stack-capable engine. isGenericError/R4,
// isError/B1.
export const errorPrototypeGraft = () => objectCreate(Error.prototype);
// a DOMException subclass that FLATTENS `name` to an own data field — the "dumb
// data name". Rejected by isDOMException (data name), and — being still
// `instanceof DOMException` — excluded from isGenericError by identity, so it
// lands as NEITHER arm. isGenericError/R3, isDOMException/R2, isError/R3.
export const flattenedDomExceptionSubclass = () =>
  new (class extends DOMException {
    /** @override */
    name = 'Flattened';
  })('m');
// a tag-only DOMException spoof: the `[[Class]]` tag says DOMException but
// name/message are DATA props, not `instanceof`, no prototype-equivalence.
export const tagSpoofedDomException = () => ({
  [Symbol.toStringTag]: 'DOMException',
  name: 'SyntaxError',
  message: 'x',
});
// an own throwing-`name` GETTER graft on the real prototype — admitted by
// isDOMException current-realm (presence-only, never invoked), but the alien
// path WOULD invoke it (realm-asymmetry, weaponized).
export const throwingGetterNameGraft = () =>
  objectCreate(domExceptionPrototype, {
    name: {
      get() {
        throw new Error('name-getter-trap');
      },
      configurable: true,
    },
  });

// ----- foreign-realm shapes (targeted by cross-realm.test.js) -----
// `Error` IS an ECMAScript intrinsic, so a REAL foreign Error is constructible in
// the vm realm. `DOMException` is NOT an intrinsic (a WHATWG global), so a foreign
// DOMException is a SYNTHETIC: a foreign class carrying the `[object DOMException]`
// tag + WeakMap-backed name/message getters — the browser-DOMException stand-in
// the cross-realm structural arm is designed to admit.

export const foreignError = () => foreignRealmEval('new Error("f")');
export const foreignTypeError = () => foreignRealmEval('new TypeError("f")');
export const foreignErrorSubclass = () =>
  foreignRealmEval('new (class X extends Error {})("f")');
export const foreignPlainErrorShaped = () =>
  foreignRealmEval('({ name: "Error", message: "" })');

export const foreignDomException = () =>
  foreignRealmEval(`(() => {
    const slot = new WeakMap();
    class DOMException {
      constructor(m, n) { slot.set(this, { m, n }); }
      get name() { return slot.get(this).n; }
      get message() { return slot.get(this).m; }
    }
    Object.defineProperty(DOMException.prototype, Symbol.toStringTag, { get(){return 'DOMException';}, configurable:true });
    return new DOMException('synthetic', 'SecurityError');
  })()`);

// a FOREIGN flattened DOMException — subclasses the foreign Error, tags
// DOMException, but flattens `name` to an own data field and carries a real
// stack. The accepted realm-asymmetry: isDOMException rejects it (broken
// contract), and — no cross-realm identity guard — isGenericError classifies it
// as a generic Error. isGenericError/B2, iARGE/B1.
export const foreignFlattenedDomException = () =>
  foreignRealmEval(`(() => {
    class DOMException extends Error {
      constructor(m, n) { super(m); this._n = n; }
      get [Symbol.toStringTag]() { return 'DOMException'; }
    }
    const d = new DOMException('m', 'RealName');
    Object.defineProperty(d, 'name', { value: 'Flattened', writable:true, enumerable:true, configurable:true });
    return d;
  })()`);

// ----- throw-safety probes (error's re-derived hostile set) -----
// error's read surface: the `instanceof` prototype-walk (isCurrentRealm*Instance),
// the alien-walk `getInertPrototypeOf` + `getInertDescriptor`, the direct
// `name`/`message` reads (doesImplementMinimumErrorContract), the captured stack
// getter (retrieveErrorStack), and — DOMException-only — the inert getter-presence
// reads (never invoked current-realm). The public-reachable throw-surfaces:

// (1) prototype-trap: a Proxy whose `getPrototypeOf` throws — hits the
// `instanceof` walk (isCurrentRealm*Instance try/catch) AND the alien
// `getInertPrototypeOf`. All four → false, not thrown.
export const prototypeTrapProxy = () =>
  new Proxy(
    {},
    {
      getPrototypeOf() {
        throw new Error('proto-trap');
      },
    },
  );

// (2) descriptor-trap: a value over a `[[Prototype]]` whose
// `getOwnPropertyDescriptor` throws — the alien walk's `getInertDescriptor`
// (constructor read) and `hasInertGetter` (DOMException contract) absorb it.
export const valueOverDescriptorTrap = () =>
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

// (3) accessor-throw on `name`: a genuine Error (instanceof, reachable stack)
// whose own `name` getter throws — reaches `doesImplementMinimumErrorContract`'s
// direct read → try/catch → false. The error-specific public row (analog of
// evented's aborted-getter-throw). isGenericError / isError → false; isDOMException
// → false (not a DOMException); isAbortError → false (isError gate fails).
export const throwingNameError = () => {
  const e = new Error('boom');
  Object.defineProperty(e, 'name', {
    get() {
      throw new Error('name-trap');
    },
    configurable: true,
  });
  return e;
};

// (4) accessor-throw on `message`: same, on `message`.
export const throwingMessageError = () => {
  const e = new Error('boom');
  Object.defineProperty(e, 'message', {
    get() {
      throw new Error('message-trap');
    },
    configurable: true,
  });
  return e;
};

// helper-level hostile probes (NOT public rows — used by _internal/helpers.test.js):

// a Proxy prototype whose `ownKeys` trap throws — drives
// `doesImplement{GenericError,DOMException}PrototypeContract`'s
// `getOwnPropertyDescriptors` into its try/catch. Helper-level: the public path
// fails an earlier gate before the prototype-contract walk runs (verified).
export const throwingOwnKeysProto = () =>
  new Proxy(
    {},
    {
      ownKeys() {
        throw new Error('ownKeys-trap');
      },
    },
  );

// ----- axis-1 contract matrix -----
// Each row: a fresh-value factory + the expected outcome of all four public
// predicates + the spec vector IDs the row covers. `spec.test.js` asserts every
// cell and guards that every row scores every predicate (no silent gaps).

/**
 * @typedef {object} SpecRow
 * @property {string} description - human-readable candidate description
 * @property {() => unknown} make - fresh-value factory
 * @property {{ isGenericError: boolean, isDOMException: boolean, isError: boolean, isAbortError: boolean }} expected - expected outcome of each predicate
 * @property {string[]} vectors - spec vector IDs this row covers
 */

const T = true;
const F = false;

/** @type {Record<string, SpecRow>} */
export const specMatrix = {
  plainError: {
    description: 'a direct `new Error("boom")`',
    make: plainError,
    expected: { isGenericError: T, isDOMException: F, isError: T, isAbortError: F },
    vectors: ['isGenericError/A1', 'isError/A1', 'isAbortError/R1', 'isDOMException/R1'],
  },
  typeError: {
    description: 'a `new TypeError("x")`',
    make: typeError,
    expected: { isGenericError: T, isDOMException: F, isError: T, isAbortError: F },
    vectors: ['isGenericError/A1', 'isError/A1'],
  },
  rangeError: {
    description: 'a `new RangeError()`',
    make: rangeError,
    expected: { isGenericError: T, isDOMException: F, isError: T, isAbortError: F },
    vectors: ['isGenericError/A1', 'isError/A1'],
  },
  errorSubclassInstance: {
    description: 'a `class X extends Error {}` instance',
    make: errorSubclassInstance,
    expected: { isGenericError: T, isDOMException: F, isError: T, isAbortError: F },
    vectors: ['isGenericError/A2', 'isError/A3'],
  },
  namedErrorSubclass: {
    description: 'an Error subclass with an own data `name` field',
    make: namedErrorSubclass,
    expected: { isGenericError: T, isDOMException: F, isError: T, isAbortError: F },
    vectors: ['isGenericError/A3'],
  },
  domException: {
    description: 'a direct `new DOMException("m", "SyntaxError")`',
    make: domException,
    expected: { isGenericError: F, isDOMException: T, isError: T, isAbortError: F },
    vectors: ['isDOMException/A1', 'isError/A2', 'isGenericError/R1'],
  },
  abortDomException: {
    description: 'a `new DOMException("aborted", "AbortError")`',
    make: abortDomException,
    expected: { isGenericError: F, isDOMException: T, isError: T, isAbortError: T },
    vectors: ['isDOMException/A1', 'isAbortError/A1', 'isError/A2'],
  },
  domExceptionSubclass: {
    description: 'a DOMException subclass keeping the getter name (`super(m, name)`)',
    make: domExceptionSubclass,
    expected: { isGenericError: F, isDOMException: T, isError: T, isAbortError: F },
    vectors: ['isDOMException/A2', 'isGenericError/R2'],
  },
  timeoutAbortError: {
    description: 'an Error subclass named `TimeoutAbortError`',
    make: timeoutAbortError,
    expected: { isGenericError: T, isDOMException: F, isError: T, isAbortError: T },
    vectors: ['isAbortError/A2', 'isGenericError/A3'],
  },
  errorNamedAbort: {
    description: 'a real Error with own `name` = `AbortError`',
    make: errorNamedAbort,
    expected: { isGenericError: T, isDOMException: F, isError: T, isAbortError: T },
    vectors: ['isAbortError/A3'],
  },
  plainErrorShaped: {
    description: 'a plain `{ name: "Error", message: "" }`',
    make: plainErrorShaped,
    expected: { isGenericError: F, isDOMException: F, isError: F, isAbortError: F },
    vectors: ['isGenericError/R5', 'isDOMException/R5', 'isError/R1', 'isAbortError/R2'],
  },
};

// ----- cross-cutting rejection inputs (all four predicates → false) -----
// CC/nullish + the primitive and function type-categories that are not errors.
// Covers the reject-rows for non-error primitives/functions across all four
// predicates — e.g. isError/R2 (`42`, `'Error'`, `null`, `undefined`, `{}`).
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

// ----- throw-safety matrix (hostile-input-class × predicate) -----
// The universal invariant (docs/spec/README.md → "Throw-safety"; ERROR.spec.md
// Module-contract Throw-safety paragraph): every public predicate answers a
// boolean on EVERY hostile input and never propagates a throw. Each cell asserts
// BOTH not-thrown AND the honest by-contract verdict.
//
// The `tag-getter-throw` and `ownKeys-trap` classes are HELPER-level boundaries
// (the graft-filter / getter-presence gates fail before the walk reaches
// `getTypeSignature` / `getOwnPropertyDescriptors`), pinned in
// `_internal/helpers.test.js` — NOT rows here.

/**
 * @typedef {object} ThrowSafetyRow
 * @property {string} surface - the throw-surface class this row exercises
 * @property {() => unknown} make - fresh hostile-value factory
 * @property {{ isGenericError: boolean, isDOMException: boolean, isError: boolean, isAbortError: boolean }} expected - honest verdict per predicate (all must NOT throw)
 */

/** @type {Record<string, ThrowSafetyRow>} */
export const throwSafetyMatrix = {
  prototypeTrap: {
    surface: 'prototype-trap: Proxy whose `getPrototypeOf` throws',
    make: prototypeTrapProxy,
    expected: { isGenericError: F, isDOMException: F, isError: F, isAbortError: F },
  },
  descriptorTrapOnPrototype: {
    surface:
      'descriptor-trap: value over a `[[Prototype]]` whose `getOwnPropertyDescriptor` throws',
    make: valueOverDescriptorTrap,
    expected: { isGenericError: F, isDOMException: F, isError: F, isAbortError: F },
  },
  nameGetterThrow: {
    surface: 'accessor-throw: a genuine Error whose own `name` getter throws',
    make: throwingNameError,
    expected: { isGenericError: F, isDOMException: F, isError: F, isAbortError: F },
  },
  messageGetterThrow: {
    surface: 'accessor-throw: a genuine Error whose own `message` getter throws',
    make: throwingMessageError,
    expected: { isGenericError: F, isDOMException: F, isError: F, isAbortError: F },
  },
};

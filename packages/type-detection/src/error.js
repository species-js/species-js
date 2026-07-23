// @ts-check

/**
 * @module @species-js/type-detection/error
 *
 * Error value detection, DOMException discrimination, and abort-error
 * refinement.
 *
 * Three public predicates split the error surface: {@link isGenericError}
 * (an `Error` that is not a `DOMException`), {@link isDOMException}, and
 * {@link isError} (either — the {@link AnyError} union). Each captures its
 * realm's `Error` and `DOMException` constructor-and-prototype pair once
 * at module-load, validated against the spec-defined prototype shape, then
 * dispatches per realm: a local-realm value is confirmed by the inexpensive
 * `instanceof` fast-path, a foreign-realm value by a throw-safe prototype
 * walk that matches the captured shape. {@link isError} prefers native
 * ECMA-262 `Error.isError` when the runtime provides it (Node 23+, modern
 * browsers) and binds to the {@link isAnyError} polyfill otherwise.
 *
 * The polyfill's structural gate pairs a minimum duck-type (`name` and
 * `message` strings) with a stack-graft filter: the module probes at load
 * whether the environment populates `Error` stacks at all
 * ({@link ERROR_STACK_CAPABLE}) and, where it does, rejects error-shaped
 * values that expose no reachable `stack` — the observable side effect
 * that separates a genuine error from an `Object.create(Error.prototype)`
 * graft. Because engines disagree on both stack support and whether
 * `DOMException` subclasses `Error`, the realm-partitioned paths are the
 * load-bearing mechanism, not a fast-path convenience.
 *
 * {@link isAbortError} refines {@link isError} via a suffix match on the
 * error's `name`, capturing the abort-channel naming convention.
 */

import { TRUSTED_DATA_CONFIRMATION } from '#foundation';

import {
  globalContext,
  restrictedDescriptorOptions,
  defineProperties,
  getOwnPropertyDescriptors,
  getOwnPropertyDescriptor,
  INSTANCE_LESS_CONSTRUCTOR,
} from '#config';

import {
  getSafePrototypeOf,
  getNextAvailableSafeDescriptor,
  hasInertGetter,
  getTypeSignature,
  getVerifiedOwnName,
  getValidatedStandardConstructorAndPrototypeTuple,
} from '#utility';

import { isCallable, isFunction, isClass } from '#function';
import { isStringValue } from '#primitive';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {typeof import('#config').INSTANCE_LESS_CONSTRUCTOR} NEVER_INVOKED_CONSTRUCTOR */
/** @typedef {import('#config').BlankDictionary} BlankDictionary */

/** @typedef {import('#utility').PropertyDescriptor} PropertyDescriptor */
/** @typedef {import('#function').NewableFunction} NewableFunction */

/**
 * The shape of an Error-prototype's own `toString` method. Spec-defined
 * as `Error.prototype.toString` per ECMA-262 §20.5.3.4 — invoked with
 * the prototype as `this`, returns the prototype's name (or `name + ': ' + message`
 * when `message` is non-empty). Used to type the descriptor-extracted
 * toString function before invoking it via `.call(prototype)`.
 * @typedef {(this: object) => string} ErrorPrototypeToStringMethod
 */

/** @typedef {import('#error').ErrorConstructorES2025} ErrorConstructorES2025 */

/** @typedef {import('#error').DOMException} DOMException */
/** @typedef {import('#error').AnyError} AnyError */

/** @typedef {import('#error').AbortError} AbortError */
/** @typedef {import('#error').AbortErrorName} AbortErrorName */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The realm's `Error` constructor and its `Error.prototype`, captured once
 * at module-load and validated by {@link isGenericErrorPrototypeEquivalent}
 * against the spec-defined prototype shape. When validation fails (a
 * tampered or absent global `Error`), the tuple collapses to the inert
 * `[INSTANCE_LESS_CONSTRUCTOR, BlankDictionary]` sentinel, so every
 * downstream `instanceof` is uniformly `false` rather than throwing. The
 * pair is realm-fixed — later reassignment of `globalThis.Error` does not
 * reach these bindings.
 */
const [GenericErrorConstructor, genericErrorPrototype] =
  /** @type {[typeof Error, object | null] | [NEVER_INVOKED_CONSTRUCTOR, BlankDictionary]} */ (
    getValidatedStandardConstructorAndPrototypeTuple(
      Error,
      isGenericErrorPrototypeEquivalent,
    )
  );

/**
 * The realm's `DOMException` constructor, captured and validated the same
 * way, with one difference the interface forces: `DOMException`'s `name` /
 * `message` are prototype accessors that throw on a bare prototype, so the
 * validator manufactures a live instance
 * (`new DOMException('security error', 'SecurityError')`) as the receiver
 * and confirms both values round-trip. The prototype half of the tuple is
 * discarded — the DOMException paths reach a prototype through each value's
 * own chain, never through this capture. On failure (a realm without
 * `DOMException`) the tuple collapses to the inert sentinel.
 */
const [DOMExceptionConstructor /*, domExceptionPrototype*/] =
  /** @type {[typeof DOMException, object | null] | [NEVER_INVOKED_CONSTRUCTOR, BlankDictionary]} */ (
    getValidatedStandardConstructorAndPrototypeTuple(
      globalContext.DOMException,
      (validatedPrototype, validatedConstructor) => {
        const candidateValue = /** @type {object} */ (
          new /** @type {NewableFunction} */ (validatedConstructor)(
            'security error',
            'SecurityError',
          )
        );
        return (
          isDOMExceptionPrototypeEquivalent(
            /** @type {object} */ (validatedPrototype),
            /** @type {NewableFunction} */ (validatedConstructor),
            candidateValue,
          ) &&
          /** @type {DOMException} */ (candidateValue).message === 'security error' &&
          /** @type {DOMException} */ (candidateValue).name === 'SecurityError'
        );
      },
    )
  );

/**
 * Reads a value's `stack` string, or `undefined` when none is reachable.
 * The access strategy is fixed once at module-load from how the realm's
 * `Error.prototype` exposes `stack`: an accessor `stack` (V8's
 * `gated-slot`) is read by invoking the captured getter with the value as
 * receiver; a data `stack` (`plain-data`) is read directly and
 * type-checked. Both forms are throw-safe — a hostile getter or an absent
 * property yields `undefined`. The chosen strategy is recorded on the
 * function's own `mode` property, surfaced as {@link errorStackMode}.
 *
 * @param {object} value - the value whose `stack` should be read
 * @returns {string | undefined} the `stack` string, or `undefined` when
 *  absent or unreadable
 * @internal
 */
export const retrieveErrorStack = ((
  /** @type {PropertyDescriptor} */ stackDescriptor,
) => {
  const getStack = stackDescriptor.get;
  return isFunction(getStack)
    ? defineProperties(
        (/** @type {object} */ value) => {
          try {
            return /** @type {string | undefined} */ (getStack.call(value));
          } catch {
            return void 0;
          }
        },
        {
          mode: { ...restrictedDescriptorOptions, value: 'gated-slot' },
          name: { ...restrictedDescriptorOptions, value: 'retrieveErrorStack' },
        },
      )
    : defineProperties(
        (/** @type {{ stack?: unknown }} */ value) => {
          try {
            const { stack } = value;
            return /** @type {string | undefined} */ (
              isStringValue(stack) ? stack : void 0
            );
          } catch {
            return void 0;
          }
        },
        {
          mode: { ...restrictedDescriptorOptions, value: 'plain-data' },
          name: { ...restrictedDescriptorOptions, value: 'retrieveErrorStack' },
        },
      );
})(
  (() => {
    try {
      return (
        getOwnPropertyDescriptor(genericErrorPrototype, 'stack') ??
        getOwnPropertyDescriptor(new GenericErrorConstructor(), 'stack') ??
        {}
      );
    } catch {
      return {};
    }
  })(),
);

/**
 * How {@link retrieveErrorStack} reaches a value's `stack` in this realm —
 * `'gated-slot'` when `Error.prototype.stack` is an accessor (the getter
 * is invoked), `'plain-data'` when it is a data property (read directly).
 * Read from the function's own `mode` property, set at capture time.
 * @internal
 */
export const errorStackMode = /** @type {{ mode: 'gated-slot' | 'plain-data' }} */ (
  /** @type {unknown} */ (retrieveErrorStack)
).mode;

/**
 * Whether this environment populates a string `stack` on thrown errors,
 * probed once at module-load by throwing a captured-constructor `Error`
 * and testing the caught value's `stack`. Engines disagree — V8 yes, some
 * others no — and the answer gates {@link doesPassErrorGraftFilter}: the
 * stack-graft filter only discriminates where a genuine error is
 * guaranteed to carry a `stack`. Throw-safe — any failure resolves to
 * `false`.
 * @internal
 */
export const ERROR_STACK_CAPABLE = ((GenericError) => {
  try {
    throw new /** @type {ErrorConstructor} */ (GenericError)();
  } catch (exception) {
    try {
      return isStringValue(/** @type {Error} */ (exception)?.stack);
    } catch {
      return false;
    }
  }
})(GenericErrorConstructor);

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Internal Error and DOMException Predicate Helpers
//
//  (based on structural analysis)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// @CLAUDE - do neither flag nor remove this code-block yet, even
//           though a stale/commented block violates the coding rules.
// /**
//  * @param {object} value
//  * @returns {boolean}
//  * @internal
//  */
// export function hasOwnErrorStack(value) {
//   try {
//     const stackDescriptor = /** @type {PropertyDescriptor} */ (
//       getOwnPropertyDescriptor(value, 'stack') ?? {}
//     );
//     const stackValue = isCallable(stackDescriptor.get)
//       ? stackDescriptor.get.call(value)
//       : stackDescriptor.value;
//     return isStringValue(stackValue) && retrieveErrorStack(value) === stackValue;
//   } catch {
//     return false;
//   }
// }

/**
 * Whether a value exposes a `stack` string reachable through
 * {@link retrieveErrorStack} — the realm's fixed access strategy, so an
 * inherited accessor `stack` counts, not only an own data property.
 *
 * @param {object} value - the value to inspect
 * @returns {boolean} `true` when a `stack` string is reachable; `false`
 *  otherwise
 * @internal
 */
export function hasReachableErrorStack(value) {
  return isStringValue(retrieveErrorStack(value));
}

/**
 * The stack-graft filter — the gate that separates a genuine error from an
 * `Object.create(Error.prototype)` graft. In an environment that does not
 * populate stacks ({@link ERROR_STACK_CAPABLE} is `false`) the filter is
 * disabled and every value passes, because a missing `stack` proves
 * nothing there. Where stacks are guaranteed, a value passes only when it
 * carries a reachable `stack` — the grafted shell, which never ran an
 * `Error` constructor, does not. A heuristic, not a slot check: it filters
 * by the observable side effect of construction, the closest reachable
 * proxy for the unobservable `[[ErrorData]]`.
 *
 * @param {object} value - the value to test
 * @returns {boolean} `true` when the value passes the graft filter;
 *  `false` otherwise
 * @internal
 */
export function doesPassErrorGraftFilter(value) {
  return !ERROR_STACK_CAPABLE || hasReachableErrorStack(value);
}

/**
 * The minimum error duck-type — `name` and `message` both present as
 * strings. The floor shared by every `Error` and `DOMException` across
 * realms, and the only structural claim that holds without inspecting
 * the prototype or a `[[Class]]` tag. Throw-safe — a hostile accessor
 * on `name` / `message` resolves to `false`.
 *
 * @param {{ message?: unknown, name?: unknown }} value - the value to test
 * @returns {boolean} `true` when both `name` and `message` are strings;
 *  `false` otherwise
 * @internal
 */
export function doesImplementMinimumErrorContract(value) {
  try {
    return isStringValue(value.message) && isStringValue(value.name);
  } catch {
    return false;
  }
}

/**
 * The generic-error structural contract — the stack-graft filter
 * ({@link doesPassErrorGraftFilter}) AND the minimum duck-type
 * ({@link doesImplementMinimumErrorContract}). The graft filter runs first
 * by deliberate precedence: the more discriminating gate, ordered ahead of
 * the `name` / `message` read so a grafted shell is rejected before its
 * coincidental string members are ever considered. On a graft it
 * short-circuits cheaply — no reachable `stack`; on a genuine error it is the
 * costlier half, since reading a reachable `stack` can force stack
 * materialization — but the ordering costs nothing there and buys the
 * early-out on the graft path.
 *
 * @param {object} value - the value to test
 * @returns {boolean} `true` when the value satisfies the generic-error
 *  contract; `false` otherwise
 * @internal
 */
export function doesImplementGenericErrorContract(value) {
  return doesPassErrorGraftFilter(value) && doesImplementMinimumErrorContract(value);
}

/**
 * The `DOMException` structural contract — `name` and `message` both
 * present as inert getters. Reading the descriptor shape (an accessor,
 * never invoked) is the marker that separates a `DOMException`, whose
 * `name` / `message` are prototype accessors backed by an internal slot,
 * from a plain `Error`, whose same-named members are data properties. The
 * legacy numeric `code` is deliberately not tested — it is discouraged and
 * carries no discriminating value.
 *
 * @param {object} value - the value to test
 * @returns {boolean} `true` when both `name` and `message` are exposed as
 *  getters; `false` otherwise
 * @internal
 */
export function doesImplementDOMExceptionContract(value) {
  return (
    // The `code` property has been deprecated and is no longer recommended.
    // https://developer.mozilla.org/en-US/docs/Web/API/DOMException/code
    hasInertGetter(value, 'message', TRUSTED_DATA_CONFIRMATION) &&
    hasInertGetter(value, 'name', TRUSTED_DATA_CONFIRMATION)
  );
}

/**
 * Whether a prototype IS the genuine root `Error.prototype` — identified
 * by its own descriptors: an own callable `toString`, string `name` and
 * `message`, and the three pinned values `toString.call(prototype) ===
 * 'Error'`, `name === 'Error'`, `message === ''`. Pinning to the root
 * values (not merely a name ending in `'Error'`) is what identifies
 * `Error.prototype` itself rather than any error-named prototype, so it
 * can serve as both the module-load capture gate and the walk target.
 * Throw-safe — a hostile prototype resolves to `false`. The check
 * precedence is load-bearing and must not be reordered.
 *
 * @param {object} prototype - the value's already-resolved `[[Prototype]]`,
 *  threaded in by the caller that read it first (decision #059)
 * @returns {boolean} `true` when the prototype is the root `Error.prototype`
 *  shape; `false` otherwise
 * @internal
 */
export function doesImplementGenericErrorPrototypeContract(prototype) {
  try {
    const descriptors = getOwnPropertyDescriptors(prototype);

    const { message, name } = descriptors;
    const toString = /** @type {PropertyDescriptor | undefined} */ (descriptors.toString);

    return (
      // never ever touch the predicate-precedence
      isCallable(toString?.value) &&
      isStringValue(name?.value) &&
      isStringValue(message?.value) &&
      /** @type {ErrorPrototypeToStringMethod} */ (toString.value).call(prototype) ===
        'Error' &&
      /** @type {PropertyDescriptor} */ (name).value === 'Error' &&
      /** @type {PropertyDescriptor} */ (message).value === ''
    );
  } catch {
    return false;
  }
}

/**
 * Whether a prototype exposes the `DOMException` accessor shape — `name`
 * and `message` each a getter with no setter, both yielding strings when
 * invoked with `value` as receiver. The receiver must be the original root
 * value, not the prototype: the spec-defined getters read an internal slot
 * and throw on anything that is not a live `DOMException`, which is exactly
 * why a real instance has to be threaded through. Unlike the generic-error
 * prototype contract it pins no specific strings — `DOMException` `name` /
 * `message` vary per instance. Throw-safe. The check precedence is
 * load-bearing and must not be reordered.
 *
 * @param {object} prototype - the value's already-resolved `[[Prototype]]`,
 *  threaded in by the caller that read it first (decision #059)
 * @param {object} value - the root value, threaded as the receiver for the
 *  spec-defined `name` / `message` getter invocations
 * @returns {boolean} `true` when both accessors are present in the spec-defined
 *  getter shape and yield strings; `false` otherwise
 * @internal
 */
export function doesImplementDOMExceptionPrototypeContract(prototype, value) {
  try {
    const descriptors = getOwnPropertyDescriptors(prototype);
    const { name, message } = descriptors;

    return (
      // never ever touch the predicate-precedence
      //
      // The `code` property has been deprecated and is no longer recommended.
      // https://developer.mozilla.org/en-US/docs/Web/API/DOMException/code
      isCallable(name?.get) &&
      !isCallable(name.set) &&
      isStringValue(name.get.call(value)) &&
      isCallable(message?.get) &&
      !isCallable(message.set) &&
      isStringValue(message.get.call(value))
    );
  } catch {
    return false;
  }
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Internal (generic) Error and (generic) DOMException Predicates
//
//  (based entirely on structural analysis)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Whether a `(prototype, constructor)` pair IS the realm's genuine `Error`
 * / `Error.prototype` pairing. Four identity markers, in load-bearing
 * order — the prototype tags `'[object Object]'` (`Error.prototype` carries
 * no `[[ErrorData]]` and no `Symbol.toStringTag`, so it reports as a plain
 * object), the constructor's own `name` is `'Error'`, the constructor is
 * class-shaped (a newable with a non-writable `prototype`), and its
 * `prototype` descriptor points back at this prototype — followed by the
 * delegated prototype-shape check
 * {@link doesImplementGenericErrorPrototypeContract}. Used both as the
 * module-load capture gate for `Error` and as the match test at each level
 * of the alien-realm prototype walk.
 *
 * @param {unknown} prototype - the value's already-resolved `[[Prototype]]`,
 *  threaded in by the caller that read it first (decision #059)
 * @param {unknown} constructor - the value's already-resolved
 *  `[[Constructor]]`, threaded in by the caller
 * @returns {boolean} `true` when the pair matches the genuine `Error` /
 *  `Error.prototype`; `false` otherwise
 * @internal
 */
export function isGenericErrorPrototypeEquivalent(prototype, constructor) {
  return (
    // never ever touch the predicate-precedence
    getTypeSignature(prototype) === '[object Object]' &&
    getVerifiedOwnName(constructor) === 'Error' &&
    isClass(constructor) &&
    getNextAvailableSafeDescriptor(constructor, 'prototype', TRUSTED_DATA_CONFIRMATION)
      ?.value === prototype &&
    doesImplementGenericErrorPrototypeContract(/** @type {object} */ (prototype))
  );
}

/**
 * Whether a `(prototype, constructor, value)` triple IS the realm's
 * genuine `DOMException` / `DOMException.prototype` pairing. The same four
 * identity markers as {@link isGenericErrorPrototypeEquivalent}, tuned to
 * `DOMException` — the prototype tags `'[object DOMException]'` (the
 * interface defines its own `Symbol.toStringTag`), the constructor's own
 * `name` is `'DOMException'`, it is class-shaped, and its `prototype`
 * descriptor points back at this prototype — followed by the delegated
 * {@link doesImplementDOMExceptionPrototypeContract}, which invokes the
 * spec accessors against `value`. The root `value` is threaded through as
 * that receiver because the `name` / `message` getters throw on anything
 * but a live `DOMException`.
 *
 * @param {object} prototype - the value's already-resolved `[[Prototype]]`,
 *  threaded in by the caller that read it first (decision #059)
 * @param {NewableFunction | undefined} constructor - the value's
 *  already-resolved `[[Constructor]]`, threaded in by the caller
 * @param {object} value - the root value, threaded as the receiver for the
 *  spec-defined accessor invocations
 * @returns {boolean} `true` when the triple matches the genuine
 *  `DOMException` / `DOMException.prototype`; `false` otherwise
 * @internal
 */
export function isDOMExceptionPrototypeEquivalent(prototype, constructor, value) {
  return (
    // never ever touch the predicate-precedence
    getTypeSignature(prototype) === '[object DOMException]' &&
    getVerifiedOwnName(constructor) === 'DOMException' &&
    isClass(constructor) &&
    getNextAvailableSafeDescriptor(constructor, 'prototype', TRUSTED_DATA_CONFIRMATION)
      ?.value === prototype &&
    doesImplementDOMExceptionPrototypeContract(prototype, value)
  );
}

/**
 * Whether a value is a foreign-realm `Error` that is not a `DOMException`.
 * The path taken when the local-realm `instanceof` fast-path misses — a
 * value from an iframe, `vm` context, or worker whose `Error` is a
 * different constructor identity.
 *
 * Rejects up front unless the value passes the generic-error contract AND
 * is not itself an alien `DOMException`. The DOMException exclusion is
 * mandatory, not incidental: in engines where `DOMException` subclasses
 * `Error` it also satisfies the `stack`-graft filter, so the contract
 * alone would admit it — the explicit {@link isAlienRealmDOMException}
 * check is what keeps `isGenericError` and `isDOMException` disjoint across
 * realms.
 *
 * Then walks the prototype chain for a level equivalent to the genuine
 * `Error.prototype`. The constructor at each level is read from that
 * level's OWN `constructor` back-reference, never from the walked child.
 * The authentic `Error` / `Error.prototype` pairing only co-locates where
 * `prototype.constructor === Error`, so reading from the child would match
 * only a direct `new Error()` and miss every subclass level (`TypeError`,
 * `class X extends Error`). Throw-safe throughout — a hostile prototype or
 * accessor collapses to `false`.
 *
 * @template [T=unknown]
 * @param {T} value - the value to test
 * @returns {value is T & Error} `true` when the value is a foreign-realm
 *  generic Error, narrowing `value` to `T & Error`; `false` otherwise
 * @internal
 */
export function isAlienRealmGenericError(value) {
  if (
    !value ||
    !doesImplementGenericErrorContract(value) ||
    // - the alien-realm predicate-path is forced to actively check
    //   against `Error`-subclassed `DOMException` instances which
    //   implement the `Error` specific `stack`-contract as well.
    isAlienRealmDOMException(value)
  ) {
    return false;
  }
  // The constructor is read from `prototype`, not from the walked node: the
  // genuine `Error`/`Error.prototype` pair only ever co-locates on the level
  // whose OWN `constructor` back-references it (`Error.prototype.constructor ===
  // Error`). Reading it from the child node instead aligns only for a DIRECT
  // `new Error()` and silently misses every subclass level (`TypeError`,
  // `class X extends Error`) whose chain reaches the realm's `Error.prototype`.
  let node = /** @type {unknown} */ (value);

  let result = false;
  let prototype;

  while (node !== null) {
    prototype = getSafePrototypeOf(node) ?? null;

    if (
      prototype !== null &&
      isGenericErrorPrototypeEquivalent(
        prototype,
        getNextAvailableSafeDescriptor(
          prototype,
          'constructor',
          TRUSTED_DATA_CONFIRMATION,
        )?.value,
      )
    ) {
      result = true;
      prototype = null;
    }
    node = prototype;
  }
  return result;
}

/**
 * Whether a value is a foreign-realm `DOMException`. The path taken when
 * the local-realm `instanceof DOMException` fast-path misses.
 *
 * Rejects up front unless the value passes the DOMException contract (both
 * `name` and `message` exposed as inert getters). Then walks the prototype
 * chain for a level equivalent to the genuine `DOMException.prototype`,
 * reading each level's constructor from its OWN `constructor`
 * back-reference (the same subclass-safe reason as the generic walker).
 * The original root `value` — never the walked node — is threaded as the
 * receiver for the equivalence check, because the spec-defined `name` /
 * `message` accessors throw unless invoked on a live `DOMException`.
 * Throw-safe throughout.
 *
 * @template [T=unknown]
 * @param {T} value - the value to test
 * @returns {value is T & DOMException} `true` when the value is a
 *  foreign-realm DOMException, narrowing `value` to `T & DOMException`;
 *  `false` otherwise
 * @internal
 */
export function isAlienRealmDOMException(value) {
  if (!value || !doesImplementDOMExceptionContract(value)) {
    return false;
  }
  // Two coupled reads: the constructor comes from `prototype` (its OWN
  // `constructor` back-reference — same subclass-safe reason as the generic
  // walker), while the receiver stays the ORIGINAL root `value`. The
  // spec-defined `name` / `message` accessors throw unless invoked on a real
  // DOMException instance, so the walked `node` must never be passed as the
  // receiver.
  let node = /** @type {unknown} */ (value);

  let result = false;
  let prototype;

  while (node !== null) {
    prototype = getSafePrototypeOf(node) ?? null;

    if (
      prototype !== null &&
      isDOMExceptionPrototypeEquivalent(
        prototype,
        /** @type {NewableFunction | undefined} */ (
          getNextAvailableSafeDescriptor(
            prototype,
            'constructor',
            TRUSTED_DATA_CONFIRMATION,
          )?.value
        ),
        /** @type {object} */ (value),
      )
    ) {
      result = true;
      prototype = null;
    }
    node = prototype;
  }
  return result;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Internal (current-realm-instance based) Error and DOMException Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Whether a value is an `instanceof` the captured current-realm `Error`
 * constructor. The inexpensive local-realm fast-path — a single prototype-chain
 * walk against the realm-fixed `Error`.
 *
 * Admits current-realm `DOMException` instances in engines where
 * `DOMException` subclasses `Error` (a Node `DOMException` is `instanceof
 * Error`). "Generic" here names the captured `Error` constructor, not the
 * Error-not-DOMException distinction — that subtraction is the caller
 * {@link isGenericError}'s job, via an explicit
 * {@link isCurrentRealmDOMExceptionInstance} exclusion. Throw-safe against
 * a poisoned `Symbol.hasInstance`.
 *
 * @template [T=unknown]
 * @param {T} value - the value to test
 * @returns {value is T & Error} `true` when the value is a current-realm
 *  `Error` instance, narrowing `value` to `T & Error`; `false` otherwise
 * @internal
 */
export function isCurrentRealmGenericErrorInstance(value) {
  try {
    return value instanceof GenericErrorConstructor;
  } catch {
    return false;
  }
}

/**
 * Whether a value is an `instanceof` the captured current-realm
 * `DOMException` constructor — the inexpensive local-realm fast-path for
 * DOMException. Throw-safe against a poisoned `Symbol.hasInstance`; when
 * the realm has no `DOMException` the capture is the inert sentinel and
 * this is uniformly `false`.
 *
 * @template [T=unknown]
 * @param {T} value - the value to test
 * @returns {value is T & DOMException} `true` when the value is a
 *  current-realm `DOMException` instance, narrowing `value` to
 *  `T & DOMException`; `false` otherwise
 * @internal
 */
export function isCurrentRealmDOMExceptionInstance(value) {
  try {
    return value instanceof DOMExceptionConstructor;
  } catch {
    return false;
  }
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Public (generic) Error and (generic) DOMException Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Narrows a value to a generic `Error` — one that is not a `DOMException`.
 *
 * Realm-partitioned, with the `DOMException` exclusion applied first and by
 * identity: a current-realm `DOMException` instance is rejected up front
 * through {@link isCurrentRealmDOMExceptionInstance} (an `instanceof` check),
 * ahead of any contract test or prototype walk. Anchoring the exclusion on
 * identity rather than on the DOMException contract is load-bearing — where
 * `DOMException` subclasses `Error` it also satisfies the generic-error
 * (stack) contract, and a `DOMException` whose contract is broken (an own
 * data-property `name`, the shape {@link isDOMException} rejects) is still an
 * `instanceof` `DOMException`, so an identity guard keeps it out of the
 * generic-error arm where a contract guard would let it slip through.
 *
 * Past that guard the dispatch is the usual two-arm split. A current-realm
 * `Error` instance is confirmed structurally by
 * {@link doesImplementGenericErrorContract} (the fast, common path); a
 * foreign-realm value falls to {@link isAlienRealmGenericError}, which walks
 * the prototype chain for an `Error.prototype`-equivalent level and re-applies
 * the DOMException exclusion structurally, on contract, for the realm where
 * `instanceof` cannot reach.
 *
 * The exclusion therefore holds by two different means — exact identity in the
 * current realm, structural contract across realms — and one accepted
 * asymmetry follows: a foreign `DOMException` whose contract is broken is not
 * recognized as a `DOMException` by the structural arm and is classified as a
 * generic `Error`, because the current-realm identity guard has no cross-realm
 * equivalent. A well-formed `DOMException` of either realm is excluded.
 *
 * That exclusion is a runtime guarantee, not a type-level one: TypeScript
 * has no negation type, so `value is T & Error` cannot spell "and not a
 * `DOMException`". It does not need to — because `DOMException` is not
 * modeled as an `Error` subtype, `Error` and `DOMException` are already
 * disjoint arms of {@link AnyError}, so `T & Error` excludes `DOMException`
 * structurally in ordinary use; the runtime check remains the authoritative
 * one.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an error
 * @returns {value is T & Error} `true` when the value is a generic `Error`
 *  and not a `DOMException`; `false` otherwise
 */
export function isGenericError(value) {
  // never ever touch the predicate-precedence

  // Exclude every current-realm DOMException up front, by IDENTITY — not by
  // contract. Where DOMException subclasses Error it also passes the
  // generic-error (stack) contract, and a DOMException with a broken contract
  // (a rejected data-property `name`) would slip past a contract-based guard
  // and be walked into the generic-error arm; an `instanceof` check cannot be
  // fooled that way.
  if (!value || isCurrentRealmDOMExceptionInstance(value)) {
    return false;
  }
  if (isCurrentRealmGenericErrorInstance(value)) {
    return doesImplementGenericErrorContract(value);
  }
  return isAlienRealmGenericError(value);
}

/**
 * Narrows a value to {@link DOMException}.
 *
 * Realm-partitioned. A truthy current-realm `DOMException` instance is
 * confirmed structurally by {@link doesImplementDOMExceptionContract};
 * everything else falls to {@link isAlienRealmDOMException} for the
 * foreign-realm prototype walk. No fast-path exclusion is needed here — a
 * `DOMException` is the specific type, so a current-realm-instance hit is
 * unambiguous.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a DOMException
 * @returns {value is T & DOMException} `true` when the value is a
 *  `DOMException`, narrowing `value` to `T & DOMException`; `false`
 *  otherwise
 */
export function isDOMException(value) {
  // never ever touch the predicate-precedence
  return !!value && isCurrentRealmDOMExceptionInstance(value)
    ? doesImplementDOMExceptionContract(value)
    : isAlienRealmDOMException(value);
}

/**
 * Narrows a value to {@link AnyError} — an `Error` or a `DOMException`.
 * The {@link isError} polyfill body, used when the runtime lacks native
 * `Error.isError`.
 *
 * Realm-partitioned with the DOMException arm ordered first: a truthy
 * current-realm `DOMException` is confirmed by its contract; else a
 * current-realm `Error` by the generic contract; else the value falls to
 * the two foreign-realm walks (`isAlienRealmDOMException ||
 * isAlienRealmGenericError`). Checking DOMException ahead of Error matters
 * where the two co-classify — a Node `DOMException` is also `instanceof
 * Error`, so the more specific arm must win. Unlike {@link isGenericError}
 * this admits both branches, so no cross-exclusion is applied.
 *
 * Exported `@internal` for tests and for callers that want the polyfill
 * semantics regardless of the runtime's native `Error.isError`.
 *
 * The polyfill is not a widening superset of the native check: its stack-graft
 * filter rejects an `Object.create(Error.prototype)` graft wherever the
 * environment guarantees stacks ({@link ERROR_STACK_CAPABLE}), converging on
 * the native `[[ErrorData]]` verdict rather than widening past it; only where
 * no stacks are populated — the filter disabled — does it admit grafts native
 * would reject.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an error
 * @returns {value is T & AnyError} `true` when the value is an `Error` or
 *  `DOMException`, narrowing `value` to `T & AnyError`; `false` otherwise
 * @internal
 */
export function isAnyError(value) {
  // never ever touch the predicate-precedence
  return !!value && isCurrentRealmDOMExceptionInstance(value)
    ? doesImplementDOMExceptionContract(value)
    : isCurrentRealmGenericErrorInstance(value)
      ? doesImplementGenericErrorContract(value)
      : isAlienRealmDOMException(value) || isAlienRealmGenericError(value);
}

// Native `Error.isError` capture. `(Error as ErrorConstructorES2025).isError`
// reads the optional method honestly — the type is
// `((value: unknown) => value is AnyError) | undefined`, narrowed by
// the runtime `isFunction` check below. Realm-fixed at module-load:
// later tampering with `globalThis.Error` does not reach this binding.
const nativeIsError = /** @type {import('#error').isError | undefined} */ (
  GenericErrorConstructor !== INSTANCE_LESS_CONSTRUCTOR
    ? /** @type {ErrorConstructorES2025} */ (GenericErrorConstructor).isError
    : void 0
);

/**
 * Narrows a value to {@link AnyError} — the public Error predicate.
 *
 * Bound once at module-load: native ECMA-262 `Error.isError` when the
 * captured realm provides it (ES2025+ — Node 23+, modern browsers), the
 * {@link isAnyError} polyfill otherwise. The choice is realm-fixed — it
 * does not re-read `globalThis.Error` per call, so later tampering with the
 * global `Error.isError` cannot reach this binding.
 *
 * Native `Error.isError` is the spec-precise check — it reads the internal
 * `[[ErrorData]]` slot, unobservable from userland. The polyfill approximates
 * that slot structurally: it pairs the minimum duck-type with the stack-graft
 * filter, which rejects an `Object.create(Error.prototype)` graft wherever the
 * environment guarantees stacks ({@link ERROR_STACK_CAPABLE}), converging on
 * the native `[[ErrorData]]` verdict rather than widening past it; only where
 * no stacks are populated does the filter stand down and the polyfill admit
 * grafts native would reject. The generic `T` surface is applied even though
 * the captured native method is non-generic per its ES2025 declaration —
 * runtime semantics are unchanged, only the type-surface widens.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an error
 * @returns {value is T & AnyError} `true` when the value carries
 *  `[[ErrorData]]` (native) or matches the polyfill semantics, narrowing
 *  `value` to `T & AnyError`; `false` otherwise
 * @example
 * isError(new Error('boom'));                   // true
 * isError(new TypeError('x'));                  // true
 * isError(new DOMException('msg', 'XError'));   // true
 * isError(null);                                // false
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/isError}
 */
export const isError = /** @type {import('#error').isError} */ (
  isFunction(nativeIsError) ? nativeIsError : isAnyError
);

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Public AbortError Predicate
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Narrows a value to {@link AbortError} — a {@link AnyError} whose
 * `name` ends with the `'AbortError'` suffix.
 *
 * Composes {@link isError} with an explicit `name` string-type check
 * and a suffix-match on `value.name`. Short-circuit `&&` runs `isError`
 * first as the inexpensive gate, then `isStringValue(value.name)` to
 * confirm the `name` is a string, then the suffix check. The string-type
 * gate is load-bearing because neither the native `Error.isError` (which
 * inspects only the `[[ErrorData]]` slot) nor the polyfill's
 * prototype-walk verifies the value's own `name` override. An Error
 * with `Object.defineProperty(err, 'name', { value: 42 })` passes
 * `isError`, but its `name` is not a string and the bare suffix-call
 * would throw `TypeError`.
 *
 * Captures the abort-channel naming convention shared by:
 *
 * - DOM WHATWG `AbortSignal.abort()`, which rejects with a
 *   `DOMException` named `'AbortError'`.
 * - `AbortController.abort()`, which propagates the same name through
 *   the signal it controls.
 * - Userland abortable operations that wrap the convention with a
 *   qualifier prefix (`'TimeoutAbortError'`, `'UserAbortError'`).
 *
 * Suffix-match by design — exact equality would reject the legitimate
 * qualified variants (`'TimeoutAbortError'`, `'UserAbortError'`). The
 * empty-prefix case `'AbortError'` is included by the {@link AbortErrorName}
 * template-literal pattern.
 *
 * Does not verify any abort-channel _mechanics_ (no inspection of
 * `AbortSignal.aborted`, no link to an `AbortController`). The check is
 * purely on the error's name. Producer-side inspection of the abort
 * channel belongs to predicates in the `evented` module
 * (`isAbortSignal`, `isAbortSignalLike`).
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & AbortError`; `T = unknown` collapses to `AbortError`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an abort error
 * @returns {value is T & AbortError} `true` when the value is an Error
 *  whose `name` is a string ending with `'AbortError'`, narrowing
 *  `value` to `T & AbortError`; `false` otherwise
 * @example
 * isAbortError(new DOMException('aborted', 'AbortError')); // true
 *
 * class TimeoutAbortError extends Error {
 *   name = 'TimeoutAbortError';
 * }
 * isAbortError(new TimeoutAbortError());                   // true
 *
 * isAbortError(new Error('plain'));                        // false (no suffix)
 * isAbortError({ name: 'AbortError' });                    // false (not an Error)
 * isAbortError(null);                                      // false
 */
export function isAbortError(value) {
  return isError(value) && isStringValue(value.name) && value.name.endsWith('AbortError');
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

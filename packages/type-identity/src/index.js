// @ts-check

/**
 * @module @species-js/type-identity
 *
 * Tamper-resistant type identity for userland constructors.
 *
 * Two sealing entries write frozen descriptors, and one verification entry reads
 * them back inertly. {@link defineStableTypeIdentity} seals a constructor's `name`,
 * its prototype's `constructor` back-reference, and a `Symbol.toStringTag` getter.
 * {@link brandFunctionName} seals `name` alone, and {@link doesCarryStableTypeIdentity}
 * reports whether every criterion holds.
 *
 * Neither sealing entry throws. Each reports its rejections as an
 * `IdentityDefinitionResult`, so an invalid argument and an un-shapeable
 * slot reach the caller through one channel.
 *
 * Wrapped reasons are built with a capability-probed `Error`, since the
 * `cause` option post-dates this package's ES2020 floor. See the
 * `Error-Cause Capability-Seam` section below.
 *
 * See the sibling `.d.ts` for the contract. This `.js` carries the runtime
 * implementation with parallel JSDoc.
 */

import {
  globalContext,
  getPrototypeOf,
  defineProperty,
  getOwnPropertyDescriptor,
} from '#config';

import {
  objectHasOwn,
  frozenEntryDescriptor,
  sealedEntryAccessor,
  hasOwnWritablePrototype,
  hasOwnNonWritablePrototype,
  canOwnPropertyBeShaped,
  getDefinedConstructor,
  isCallable,
  isNewableFunction,
  getFunctionSource,
  isObjectOrCallable,
  isPlainObject,
  isError,
  isString,
} from '@species-js/type-detection';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('@species-js/type-detection').PropertyDescriptor} PropertyDescriptor */

/** @typedef {import('@species-js/type-detection').AnyError} AnyError */
/** @typedef {import('@species-js/type-detection').AnyObject} AnyObject */

/** @typedef {import('@species-js/type-detection').Callable} Callable */
/** @typedef {import('@species-js/type-detection').NewableFunction} NewableFunction */

/** @typedef {import('@species-js/type-detection').ES3Function} ES3Function */
/** @typedef {import('@species-js/type-detection').ClassConstructor} ClassConstructor */

/** @typedef {import('@species-js/type-detection').BoxablePrimitive} BoxablePrimitive */

/** @typedef {import('#index').IdentityDefinitionResult} IdentityDefinitionResult */
/** @typedef {import('#index').ErrorWithCauseConstructor} ErrorWithCauseConstructor */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const String = globalContext.String;

const TypeError = globalContext.TypeError;
const RangeError = globalContext.RangeError;

const toStringTagSymbol = globalContext.Symbol.toStringTag;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Error-Cause Capability-Seam
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Resolves the `Error` constructor this module builds its wrapped reasons
 * with. A constructor that already honors the ES2022 options bag is handed
 * back unchanged. Any other is replaced by a stand-in that installs `cause`
 * itself.
 *
 * The two-argument form PARSES on every engine, so support cannot be inferred
 * from syntax. An engine without it ignores the second argument silently
 * rather than throwing, so the observable effect is probed instead. That is
 * the same capability-over-version posture as the `Number.is*` selectors in
 * `#primitive`, and as the native `Error.isError` accelerator of decision #082.
 *
 * The constructor arrives as an argument rather than being read from the
 * global. That keeps BOTH branches reachable under test: a stub which ignores
 * its second argument selects the fallback on an engine whose native `Error`
 * would not. Without the seam the fallback is dead code wherever `cause` is
 * already supported, which is every engine this package is developed on and
 * none of the older browsers it exists for.
 *
 * A throwing probe counts as a NEGATIVE result, not as an error to report.
 * The question asked is whether this constructor honors the options bag, and a
 * constructor that cannot survive being called with one plainly does not. The
 * stand-in is the answer in both cases, so the `try` is what makes the probe
 * total rather than a guard bolted onto it. Letting the throw escape would
 * instead fail module evaluation, turning a capability question into a load
 * error.
 *
 * That also settles throw-safety by construction rather than by argument. The
 * marker would hold on the closed input set alone, since the sole production
 * call supplies the realm's own `Error` and a test supplies a deliberately
 * well-behaved graft. Resting it on the `try` costs three lines and removes
 * the need to know any of that.
 *
 * @param {ErrorConstructor} ProvidedError - the constructor to probe, and to
 *  hand back unchanged when it already honors `cause`
 * @returns {ErrorWithCauseConstructor} `ProvidedError` itself when the options
 *  bag took effect; otherwise the stand-in
 * @internal
 */
export function resolveErrorWithCause(ProvidedError) {
  const probeMessage = 'cause-option-test';
  const probeCause = 'cause-value';

  const ProvidedErrorWithCause = /** @type {ErrorWithCauseConstructor} */ (ProvidedError);

  try {
    const probe = new ProvidedErrorWithCause(probeMessage, { cause: probeCause });

    if (
      probe.message === probeMessage &&
      /** @type {{ cause?: unknown }} */ (probe).cause === probeCause
    ) {
      return ProvidedErrorWithCause;
    }
  } catch {
    // - a throw answers the probe's question in the negative, so it falls
    //   through to the stand-in exactly as a missing `cause` would.
  }

  /**
   * Stand-in for engines that ignore the options bag. Builds the error, then
   * attaches `cause` as the own property the native form would have installed.
   * The descriptor flags match, so the two are indistinguishable to a consumer.
   *
   * An own-property test rather than a truthiness test, because the native
   * form distinguishes an absent `cause` from one explicitly set to
   * `undefined`. `objectHasOwn` is type-detection's ES2020-floor-safe retype —
   * a value-add, and so the one capture ADR #086 sanctions reaching across a
   * package boundary for.
   *
   * @param {string} [message] - the error message
   * @param {{ cause?: unknown }} [options] - carries `cause` when present
   * @returns {Error} the constructed error
   */
  function ErrorWithCause(message, options) {
    const error = new ProvidedError(message);

    if (isPlainObject(options) && objectHasOwn(options, 'cause')) {
      defineProperty(error, 'cause', {
        value: options.cause,
        enumerable: false,
        writable: true,
        configurable: true,
      });
    }
    return error;
  }

  // - the double cast is the lib-gap acknowledgement, and it is needed only on
  //   this branch: the stand-in is a plain function, which carries no CONSTRUCT
  //   signature for the compiler even though `new` on it works and its explicit
  //   object `return` is what `new` yields. There is no way to state "callable
  //   that is also newable" for a function declaration.
  return /** @type {ErrorWithCauseConstructor} */ (
    /** @type {unknown} */ (ErrorWithCause)
  );
}

const Error = resolveErrorWithCause(globalContext.Error);

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Utility and Helper Functions (entirely internal and non-testable)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Normalizes an arbitrary thrown value into an {@link AnyError}, so a failure
 * can promise one rather than assert it. A value that is already an error
 * passes through untouched; anything else is wrapped and carried as the
 * wrapper's `cause`.
 *
 * A `catch` binding is `unknown` for a reason. A hostile trap may throw a
 * string, a symbol, anything at all. The wrap is therefore what makes
 * `IdentityDefinitionFailure['reason']` true to its declared type.
 *
 * @param {unknown} reason - the caught value, of no guaranteed shape
 * @param {string} message - the wrapper's message; used only when wrapping
 * @returns {AnyError} `reason` itself when it is already an error; otherwise a
 *  wrapper carrying it as `cause`
 * @internal
 */
function toReportableError(reason, message) {
  return isError(reason) ? reason : new Error(message, { cause: reason });
}

/* @@throw-safe */
/**
 * Reads an own property-descriptor without letting a hostile trap escape,
 * reporting the two outcomes side by side rather than collapsing a throw into
 * the same `undefined` an absent descriptor yields.
 *
 * The caller needs that distinction. An absent `prototype` descriptor and a
 * `getOwnPropertyDescriptor` trap that threw are different failures, and only
 * the second carries a reason worth surfacing.
 *
 * @param {object | Callable} value - the target whose own descriptor is read
 * @param {PropertyKey} key - the property key to look up on `value`
 * @returns {{ error: null | AnyError, value: PropertyDescriptor | null }} the
 *  descriptor under `value` with `error` null on a clean read; otherwise the
 *  caught reason under `error`, always an `Error`, a non-error throw being
 *  wrapped and carried as its `cause`
 * @internal
 */
function getOwnPropertyDescriptorSafeResult(value, key) {
  const result =
    /** @type {{ error: null | AnyError, value: PropertyDescriptor | null }} */ ({
      error: null,
      value: null,
    });

  try {
    result.value = /** @type {PropertyDescriptor} */ (
      getOwnPropertyDescriptor(value, key)
    );
  } catch (reason) {
    result.error = toReportableError(
      reason,
      `Reading the own "${String(key)}" property-descriptor threw.`,
    );
  }
  return result;
}

/* @@throw-safe */
/**
 * Whether the own `name` slot can still take an arbitrary descriptor, so a
 * branding define would land rather than throw.
 *
 * @param {unknown} [value] - the value whose `name` slot is probed
 * @returns {boolean} `true` when `name` can still be shaped; `false` otherwise
 * @internal
 */
function canOwnNameBeShaped(value) {
  return canOwnPropertyBeShaped(value, 'name');
}

/* @@throw-safe */
/**
 * Guarded, local version of an `isES3Function` predicate.
 *
 * Narrows a value to {@link ES3Function}, the strict ES3-function shape.
 *
 * @template [T=NewableFunction]
 * @param {T & NewableFunction} value - the value to test;
 * @returns {value is T & ES3Function} `true` when the value is an
 *  ES3-shaped newable, narrowing to `T & ES3Function`; `false` otherwise
 * @internal
 */
function isES3Function(value) {
  return hasOwnWritablePrototype(value);
}

/* @@throw-safe */
/**
 * Guarded, local version of an `isCustomClass` predicate.
 *
 * Narrows a value to a custom (`class`-syntax) constructor.
 *
 * @template [T=NewableFunction]
 * @param {T & NewableFunction} value - the value to test;
 * @returns {value is T & ClassConstructor} `true` when the value is
 *  a custom-class constructor, narrowing to `T & ClassConstructor`;
 *  `false` otherwise
 * @internal
 */
function isCustomClass(value) {
  return (
    hasOwnNonWritablePrototype(value) &&
    (getFunctionSource(value) ?? '').startsWith('class')
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Type Identity Predicate Functions
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Identity Verification
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * @param {unknown} [value] - the value to inspect
 * @returns {boolean} `true` when the value carries every criterion
 *  of a stable type-identity; `false` otherwise
 */
export function doesCarryStableTypeIdentity(value = null) {
  if (value === null) {
    return false;
  }
  try {
    const [constructor, prototype] =
      /** @type {[NewableFunction | null, object | Callable | null]} */ (
        isNewableFunction(value)
          ? [
              value,
              getOwnPropertyDescriptor(
                /** @type {NewableFunction} */ (value),
                'prototype',
              )?.value ?? null,
            ]
          : [
              getDefinedConstructor(/** @type {object | BoxablePrimitive} */ (value)) ??
                null,
              getPrototypeOf(/** @type {object | BoxablePrimitive} */ (value)),
            ]
      );

    if (constructor === null || !isObjectOrCallable(prototype)) {
      return false;
    }
    const tagDescriptor = getOwnPropertyDescriptor(prototype, toStringTagSymbol) ?? {};
    const ctrDescriptor = getOwnPropertyDescriptor(prototype, 'constructor') ?? {};
    const nameDescriptor = getOwnPropertyDescriptor(constructor, 'name') ?? {};

    return (
      // getter-enforced tag-identity
      isCallable(tagDescriptor.get) &&
      !isCallable(tagDescriptor.set) &&
      !tagDescriptor.configurable &&
      !tagDescriptor.enumerable &&
      // constructor-identity
      !ctrDescriptor.writable &&
      !ctrDescriptor.configurable &&
      !ctrDescriptor.enumerable &&
      // constructor-name identity
      !nameDescriptor.writable &&
      !nameDescriptor.configurable &&
      !nameDescriptor.enumerable
    );
  } catch {
    return false;
  }
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Identity Sealing
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Defines a stable type identity for a constructor by sealing its `name`
 * property and adding a non-configurable `Symbol.toStringTag` getter.
 *
 * This enables reliable type detection that works across realms
 * (e.g., iframes) by making the constructor's identity immutable.
 * @param {ClassConstructor | ES3Function} constructor
 *  The class constructor or ES3 function to seal.
 * @param {string} constructorName
 *  The name to assign to the constructor.
 * @param {string} [taggedType]
 *  Optional tagged type for `Symbol.toStringTag`.
 *  Defaults to `constructorName` if not provided.
 * @returns {IdentityDefinitionResult} `{ success: true }` once all three slots
 *  are shaped, carrying a `warning` when `taggedType` and `constructorName`
 *  differ; otherwise `{ success: false, reason }` naming the first condition
 *  that blocked the attempt. Never throws. Every rejection is a returned
 *  value, which is why this block carries no `@throws` clauses.
 *
 *  ## What decides each rejection
 *
 *  Argument validity is settled before shapeability. A bad argument is
 *  therefore still reported against a target that could not have been sealed
 *  anyway. The `.d.ts` numbers the conditions; these are the deciders behind
 *  them, in the same order:
 *
 *  1.–2. `isNewableFunction`, then `isES3Function` / `isCustomClass`. The
 *     second pair is what rejects built-ins.
 *  3.–5. `isString` and the trimmed-empty checks on `constructorName`, then
 *     the same pair on `taggedType` when one was supplied.
 *  6. `canOwnNameBeShaped`.
 *  7. the throw-safe `prototype` descriptor read, whose own caught error
 *     becomes the `reason`.
 *  8. `isObjectOrCallable` on the resolved prototype.
 *  9.–10. `canOwnPropertyBeShaped`, for the prototype's `constructor` and
 *     then its `Symbol.toStringTag`.
 *
 *  ## Why the defines run tag, constructor, name
 *
 *  `name` is written last because it is the irreversible one. Sealing it
 *  freezes the slot, so a later failure could not be retried. Running it after
 *  both prototype writes means an ordinary failure leaves the constructor
 *  object untouched.
 *
 *  The three `canOwnPropertyBeShaped` probes above make a mid-sequence failure
 *  unreachable for ordinary targets. What survives is narrow. A hostile
 *  `prototype` can answer the probe truthfully and then refuse the define,
 *  leaving the tag installed with the constructor still clean. That state is
 *  loud rather than silent, since the retry fails on the now-unshapeable tag.
 *  The `try` is therefore a backstop for what a probe cannot foresee, not the
 *  primary guard.
 */
export function defineStableTypeIdentity(constructor, constructorName, taggedType) {
  // guard.
  if (!isNewableFunction(constructor)) {
    return {
      success: false,
      reason: new TypeError(
        'The provided "constructor" parameter has to be at least a constructable function-type.',
      ),
    };
  }
  // guard.
  if (!isES3Function(constructor) && !isCustomClass(constructor)) {
    return {
      success: false,
      reason: new TypeError(
        'Built-in constructors are not supported. The "Stable Type Identity" feature anyhow is useful for just ES5 class-constructors and ES3 constructor functions.',
      ),
    };
  }
  // - Both above local predicates `isES3Function` or `isCustomClass` do grand from
  //   here a safe direct property-descriptor access for the passed constructor. The
  //   guards either invoke `hasOwnWritablePrototype` or `hasOwnNonWritablePrototype`,
  //   and each for itself has proven already the safe access.

  // guard.
  if (!isString(constructorName)) {
    return {
      success: false,
      reason: new TypeError(
        'The provided "constructorName" parameter needs to be a string.',
      ),
    };
  }
  // - ensure a string value primitive because that is what a name-descriptor will be checked
  //   for in order to pass as a stable descriptor for the reliable type-identity verification.
  constructorName = String(constructorName).trim();

  // guard.
  if (constructorName === '') {
    return {
      success: false,
      reason: new RangeError('Invalid string value passed as "constructorName".'),
    };
  }
  if (isString(taggedType)) {
    // - ensure a string value primitive because that is what a `Symbol.toStringTag`-descriptor will be
    //   checked for in order to pass as a stable descriptor for the reliable type-identity verification.
    taggedType = String(taggedType).trim();

    // guard.
    if (taggedType === '') {
      return {
        success: false,
        reason: new RangeError('Invalid string value passed as "taggedType".'),
      };
    }
  } else {
    taggedType = constructorName;
  }

  // guard.
  if (!canOwnNameBeShaped(constructor)) {
    return {
      success: false,
      reason: new TypeError(
        'The passed constructor\'s "name" property cannot be redefined.',
      ),
    };
  }
  const { error, value } = getOwnPropertyDescriptorSafeResult(constructor, 'prototype');

  // guard.
  if (error !== null) {
    return {
      success: false,
      reason: error,
    };
  }
  const prototype = /** @type {object | Callable | null } */ (
    /** @type {PropertyDescriptor & {value: unknown}} */ (
      /** @type {PropertyDescriptor} */ (value)
    ).value ?? null
  );

  // guard.
  if (!isObjectOrCallable(prototype)) {
    return {
      success: false,
      reason: new TypeError('The passed constructor\'s "prototype" property is invalid.'),
    };
  }
  // guard.
  if (!canOwnPropertyBeShaped(prototype, 'constructor')) {
    return {
      success: false,
      reason: new TypeError(
        'The passed constructor\'s prototypal "constructor" property cannot be redefined.',
      ),
    };
  }
  // guard.
  if (!canOwnPropertyBeShaped(prototype, toStringTagSymbol)) {
    return {
      success: false,
      reason: new TypeError(
        'The passed constructor\'s prototypal "Symbol.toStringTag" property cannot be redefined.',
      ),
    };
  }

  try {
    defineProperty(prototype, toStringTagSymbol, {
      // - the tag is closed over rather than read from an outer binding, so the
      //   getter cannot be made to answer differently once installed.
      get: (
        (tag) => () =>
          tag
      )(taggedType),
      ...sealedEntryAccessor,
    });
    defineProperty(prototype, 'constructor', {
      value: constructor,
      ...frozenEntryDescriptor,
    });
    defineProperty(constructor, 'name', {
      value: constructorName,
      ...frozenEntryDescriptor,
    });
  } catch (reason) {
    return {
      success: false,
      reason: toReportableError(reason, 'Defining one of the identity properties threw.'),
    };
  }

  return {
    success: true,
    ...(taggedType !== constructorName
      ? {
          warning: `2 different identifiers have been assigned, "${constructorName}" as constructor name and "${taggedType}" as tagged type.`,
        }
      : {}),
  };
}

/* @@throw-safe */
/**
 * Brands a function-type's name so code-minimization cannot rewrite it. It
 * re-defines the callable's own `name` under `frozenEntryDescriptor`, which is
 * non-enumerable, non-writable and non-configurable. That makes the brand a
 * one-way door: a second call on the same callable is refused, its slot having
 * been frozen by the first.
 *
 * Narrower than {@link defineStableTypeIdentity}, which additionally seals the
 * prototype's `constructor` and installs the `Symbol.toStringTag` getter. This
 * one touches `name` and nothing else.
 *
 * @param {Callable} fct - the function-type to brand
 * @param {string} fctName - the name to brand it with; trimmed before assignment
 * @returns {IdentityDefinitionResult} `{ success: true }` once `name` carries
 *  the brand; otherwise `{ success: false, reason }` naming the first condition
 *  that blocked it. Never throws.
 *
 *  ## What decides each rejection
 *
 *  Argument validity is settled before the slot is probed, matching
 *  {@link defineStableTypeIdentity}. The deciders, in order: `isCallable`;
 *  then `isString` and the trimmed-empty check on `fctName`; then
 *  `canOwnNameBeShaped`. The `try` is the backstop for a hostile callable that
 *  answers the probe truthfully and then refuses the define. A non-error throw
 *  is wrapped and carried as `cause`, so `reason` is always an error.
 *
 *  The success arm never carries a `warning`. That field belongs to
 *  {@link defineStableTypeIdentity}'s two-identifier case, which has no
 *  counterpart here.
 */
export function brandFunctionName(fct, fctName) {
  if (!isCallable(fct)) {
    return {
      success: false,
      reason: new TypeError('The provided "fct" parameter needs to be a function-type.'),
    };
  }
  if (!isString(fctName)) {
    return {
      success: false,
      reason: new TypeError('The provided "fctName" parameter needs to be a string.'),
    };
  }
  // - ensure a string value primitive, because that is what a name-descriptor
  //   will be checked for by the reliable type-identity verification.
  fctName = String(fctName).trim();

  if (fctName === '') {
    return {
      success: false,
      reason: new RangeError('Invalid string value passed as "fctName".'),
    };
  }
  if (!canOwnNameBeShaped(fct)) {
    return {
      success: false,
      reason: new TypeError(
        'The passed callable\'s "name" property cannot be redefined.',
      ),
    };
  }

  try {
    defineProperty(fct, 'name', {
      value: fctName,
      ...frozenEntryDescriptor,
    });
  } catch (reason) {
    return {
      success: false,
      reason: toReportableError(reason, 'Branding the "name" property threw.'),
    };
  }

  return { success: true };
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

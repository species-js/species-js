// @ts-check

/**
 * @module @species-js/type-identity
 *
 * Tamper-resistant type identity for userland constructors.
 *
 * Two entries write frozen descriptors, and one verification entry reads
 * them back inertly. {@link defineStableTypeIdentity} freezes a constructor's `name`,
 * its prototype's `constructor` back-reference, and a `Symbol.toStringTag` getter —
 * the structural evidence a userland type is recognized by once it crosses a realm
 * boundary, where `instanceof` fails on constructor identity.
 * {@link brandFunctionName} freezes `name` alone, and {@link doesCarryStableTypeIdentity}
 * reports whether every criterion holds.
 *
 * Neither freezing entry throws. Each reports its rejections as an
 * `IdentityDefinitionResult`, so an invalid argument and an un-shapeable
 * slot reach the caller through one channel.
 *
 * Wrapped reasons are built with a capability-probed `Error`, since the
 * `cause` option post-dates this package's ES2020 floor. The resolved
 * constructor is bound to the module-scoped name `Error`, so every `new Error(…)`
 * below goes through that seam rather than to the global binding. See the
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
  objectCreate,
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
 * error — and it earns the `@@throw-safe` marker by construction, rather than
 * by an argument about which constructors ever reach here.
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
   * attaches `cause` as the own property the native form would have installed,
   * under the same descriptor flags — non-enumerable, writable, configurable,
   * which is what `CreateNonEnumerableDataPropertyOrThrow` produces. Errors
   * this module builds are therefore indistinguishable from native ones.
   *
   * An own-property test rather than a truthiness test, because the native
   * form distinguishes an absent `cause` from one explicitly set to
   * `undefined`. `objectHasOwn` is type-detection's ES2020-floor-safe retype —
   * a value-add, and so the one capture ADR #086 sanctions reaching across a
   * package boundary for.
   *
   * The pair of gates is narrower than the native `IsObject(options)` plus
   * `HasProperty`, which also accepts an array, a class instance or an
   * inherited `cause`. Deliberately so: the options bag is an object literal at
   * every call site here, and a private seam owes fidelity over the inputs it
   * is actually given, not over the ones a direct caller could invent.
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
//  Internal Helpers (module-private; reached only through the entries)
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
 * the same empty answer an absent descriptor yields.
 *
 * The caller needs that distinction. An absent `prototype` descriptor and a
 * `getOwnPropertyDescriptor` trap that threw are different failures, and only
 * the second carries a reason worth surfacing.
 *
 * @param {object | Callable} value - the target whose own descriptor is read
 * @param {PropertyKey} key - the property key to look up on `value`
 * @returns {{ error: null | AnyError, value: PropertyDescriptor | null }} on a
 *  clean read, `error` is `null` and `value` carries the descriptor — or `null`
 *  when the target holds no own property under `key`, the native `undefined`
 *  being normalized so the declared type stays true. On a throw, `value` stays
 *  `null` and `error` carries the reason — always an error, a non-error throw
 *  being wrapped and carried as its `cause`
 * @internal
 */
function getOwnPropertyDescriptorAsSafeResult(value, key) {
  const result =
    /** @type {{ error: null | AnyError, value: PropertyDescriptor | null }} */ ({
      error: null,
      value: null,
    });

  try {
    // - `?? null` is what keeps the declared type honest: the native read
    //   answers `undefined` for an absent own property, and letting that
    //   through under a `PropertyDescriptor` cast would hand the caller a
    //   value its own type says it cannot receive.
    result.value =
      /** @type {PropertyDescriptor | undefined} */ (
        getOwnPropertyDescriptor(value, key)
      ) ?? null;
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
 * Narrows a value to {@link ES3Function}, the strict ES3-function shape — a
 * newable whose own `prototype` descriptor is writable. A bound newable is
 * rejected: `bind` strips the own `prototype` slot, so no ES3 shape remains.
 *
 * The predicate type-detection publishes under this name, with its
 * {@link isNewableFunction} half hoisted out to the call site. That half probes
 * `[[Construct]]` by allocating a `Proxy` and running a `new` inside a `try`,
 * and the caller has already established newability before reaching here —
 * composing the public predicate would repeat that probe on every shape test.
 * What keeps the shortcut sound is the parameter type rather than a convention:
 * `T & NewableFunction` states the precondition and `tsc` enforces it. Do not
 * "tidy" this into the public import.
 *
 * @template [T=NewableFunction]
 * @param {T & NewableFunction} value - the value to test, already known newable
 * @returns {value is T & ES3Function} `true` when the value is an
 *  ES3-shaped newable, narrowing to `T & ES3Function`; `false` otherwise
 * @internal
 */
function isES3Function(value) {
  return hasOwnWritablePrototype(value);
}

/* @@throw-safe */
/**
 * Narrows a value to a custom (`class`-syntax) constructor — a newable whose
 * own `prototype` descriptor is non-writable and whose source starts with the
 * `class` keyword. The source read is what separates a custom class from a
 * built-in one, whose source always takes the form
 * `function Foo() { [native code] }`. A bound class fails the descriptor half
 * before the source is ever read, `bind` having stripped the own `prototype`.
 *
 * The predicate type-detection publishes under this name, with its newability
 * half hoisted out to the call site — see {@link isES3Function} for why, and
 * for why it must not be tidied into the public import.
 *
 * @template [T=NewableFunction]
 * @param {T & NewableFunction} value - the value to test, already known newable
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
//  Parameter Verification
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Whether an already-newable value carries one of the two shapes
 * {@link defineStableTypeIdentity} can freeze — an ES3 constructor function or a
 * `class`-syntax constructor.
 *
 * The union of {@link isES3Function} and {@link isCustomClass}, which is a
 * shape gate rather than an origin one. A built-in constructor fails it on the
 * source read, a bound newable earlier still, `bind` having stripped the own
 * `prototype` slot both shapes are read from.
 *
 * Shaped as a predicate rather than as a verifier returning a reason, so the
 * narrowing survives the call: the entry needs `constructor` typed as something
 * whose own descriptors may be read, and a function returning a value cannot
 * hand that back to a parameter binding.
 *
 * Exported so its admissions and refusals can be asserted directly rather than
 * only through the entry's rejection order.
 *
 * @template [T=NewableFunction]
 * @param {T & NewableFunction} value - the value to test, already known newable
 * @returns {value is T & (ES3Function | ClassConstructor)} `true` when the
 *  value carries one of those two shapes, narrowing to
 *  `T & (ES3Function | ClassConstructor)`; `false` otherwise
 * @internal
 */
export function isSupportedConstructor(value) {
  return isES3Function(value) || isCustomClass(value);
}

/* @@throw-safe */
/**
 * Verifies a value as an identifier this module is willing to write into a
 * `name` slot or a `Symbol.toStringTag` getter, and hands back the normalized
 * form.
 *
 * The `{ error, value }` pair is the shape {@link
 * getOwnPropertyDescriptorAsSafeResult} already uses for "the value, or the
 * reason there is none, never a throw". Here the union is discriminated on
 * `error`, so a caller that has ruled the failing arm out reaches a `string`
 * without a cast.
 *
 * `isString` admits a boxed `String`, so the accepted value is unwrapped to its
 * primitive before it is trimmed. `new String('') === ''` is false, which would
 * otherwise walk an empty wrapper straight past the emptiness check, and a
 * `name` slot holding a wrapper object breaks every consumer reading it as the
 * string the language specifies it to be.
 *
 * `parameterName` appears only inside the rejection messages, which is what
 * lets one helper serve `constructorName`, `taggedType` and `fctName` while
 * each keeps naming the parameter its caller actually passed.
 *
 * @param {unknown} value - the candidate identifier
 * @param {string} parameterName - the parameter name to quote in a rejection
 * @returns {{ error: AnyError, value: null } | { error: null, value: string }}
 *  the trimmed, unwrapped identifier under `value` with `error` null; otherwise
 *  the reason under `error` — a `TypeError` when the value is no kind of
 *  string, a `RangeError` when it trims to empty
 * @internal
 */
export function getIdentifierAsSafeResult(value, parameterName) {
  if (!isString(value)) {
    return {
      error: new TypeError(
        `The provided "${parameterName}" parameter needs to be a string.`,
      ),
      value: null,
    };
  }
  const identifier = String(value).trim();

  if (identifier === '') {
    return {
      error: new RangeError(`Invalid string value passed as "${parameterName}".`),
      value: null,
    };
  }
  return { error: null, value: identifier };
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Public Entries
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Identity Verification
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Whether a value carries a stable type-identity — the shape
 * {@link defineStableTypeIdentity} installs.
 *
 * Resolves the constructor/prototype pair from either side of the relation. A
 * newable is taken as the constructor itself, and its prototype read out of the
 * own `prototype` descriptor's `value` rather than through property access. Any
 * other value is paired with its direct `[[Prototype]]`, its constructor
 * resolved by `getDefinedConstructor`'s inert descriptor walk.
 *
 * The three criteria are then read from descriptors alone — no getter is
 * invoked and no value coerced, which is what keeps the check inert against a
 * hostile target.
 *
 * Two details of that read are load-bearing together, and neither works alone.
 * Each flag is compared to `false` rather than negated, because a descriptor
 * that is absent has no flag to negate — a negation reads its `undefined` as
 * satisfaction, and a `Proxy` withholding a configurable `name` slot could
 * report an identity it had never been given (`carry/R9`). And the stand-in for
 * an absent descriptor is a prototype-less blank rather than an object literal,
 * because a literal inherits from `Object.prototype`: with `writable` polluted
 * there as `false`, a literal satisfies the strict comparison the negation
 * would have failed, and the same door opens from the other side
 * (`carry/B7`).
 *
 * The `try` makes rejection total. A verification entry has no second channel
 * to report through — unlike the freezing entries and their `reason` — so a trap
 * that throws mid-read is answered exactly as a value that simply lacks the
 * shape.
 *
 * Reports only that the identity is FROZEN, never that it is authentic: a third
 * party may freeze any name onto any constructor.
 *
 * @param {unknown} [value] - the value to inspect; omitted is treated as
 *  `null`, which carries no identity
 * @returns {boolean} `true` when the value carries every criterion
 *  of a stable type-identity; `false` otherwise, including for any hostile
 *  input that makes a descriptor read throw
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
    const blankDictionary = objectCreate(null);

    const tagDescriptor =
      getOwnPropertyDescriptor(prototype, toStringTagSymbol) ?? blankDictionary;
    const ctrDescriptor =
      getOwnPropertyDescriptor(prototype, 'constructor') ?? blankDictionary;
    const nameDescriptor =
      getOwnPropertyDescriptor(constructor, 'name') ?? blankDictionary;

    return (
      // getter-enforced tag-identity
      isCallable(tagDescriptor.get) &&
      !isCallable(tagDescriptor.set) &&
      tagDescriptor.configurable === false &&
      tagDescriptor.enumerable === false &&
      // constructor-identity
      ctrDescriptor.writable === false &&
      ctrDescriptor.configurable === false &&
      ctrDescriptor.enumerable === false &&
      // constructor-name identity
      nameDescriptor.writable === false &&
      nameDescriptor.configurable === false &&
      nameDescriptor.enumerable === false
    );
  } catch {
    return false;
  }
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Identity Freezing
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Freezes a stable type identity onto a constructor: a frozen `name`, a frozen
 * `constructor` back-reference on its prototype, and a non-configurable
 * `Symbol.toStringTag` getter returning `taggedType`.
 *
 * That is what makes a userland type reliably detectable across a realm
 * boundary (an iframe, a worker), where `instanceof` fails on constructor
 * identity: the frozen tag and name remain as structural evidence, and no later
 * code can rewrite the three slots this freezes.
 *
 * It does not freeze a fourth. The constructor's own `prototype` descriptor is
 * read below and never written, so an ES3 function's writable pointer stays
 * writable: freezing it would remove the property that tells the ES3 shape from
 * the class shape, and would reach past the three slots this promises. A later
 * reassignment therefore substitutes an unfrozen prototype, leaving the frozen
 * one — and everything already built from it — unaffected.
 *
 * Restricted to ES3 constructor functions and `class`-syntax constructors.
 *
 * @param {unknown} constructor - the `class` constructor or ES3 constructor
 *  function to freeze; anything else is reported as a `reason`
 * @param {string} constructorName - the name to assign to the constructor;
 *  a boxed `String` is accepted, unwrapped to its primitive and trimmed
 * @param {[] | [string]} args - the `Symbol.toStringTag` value as `args[0]`,
 *  or nothing at all. Presence is detected via `args.length` rather than
 *  `!== undefined`, so an explicitly passed `undefined` counts as supplied and
 *  is rejected; an omitted one defaults the tag to `constructorName`. When
 *  supplied it is unwrapped and trimmed exactly as `constructorName` is. The
 *  `.d.ts` carries the same two arities as `...taggedType: [] | [string]`,
 *  where an optional parameter would instead admit the `undefined` this refuses
 * @returns {IdentityDefinitionResult} `{ success: true }` once all three slots
 *  are shaped, carrying a `warning` when `taggedType` and `constructorName`
 *  differ; otherwise `{ success: false, reason }` naming the first condition
 *  that blocked the attempt. Never throws. Every rejection is a returned
 *  value, which is why this block carries no `@throws` clauses.
 *
 *  ## What decides each rejection
 *
 *  Argument validity is settled before shapeability. A bad argument is
 *  therefore still reported against a target that could not have been frozen
 *  anyway. The `.d.ts` numbers the conditions; these are the deciders behind
 *  them, in the same order:
 *
 *  1.–2. `isNewableFunction`, then {@link isSupportedConstructor}. The second is
 *     a shape gate rather than an origin one: a built-in constructor fails it
 *     on the source read, a bound newable earlier still, `bind` having stripped
 *     the own `prototype` slot both shapes are read from.
 *  3.–6. {@link getIdentifierAsSafeResult} twice — once for `constructorName`,
 *     then for `args[0]`, but only once `args.length` has settled that a third
 *     argument was supplied at all, presence being decided before validity.
 *     Each call decides two of the four conditions, the `TypeError` for a value
 *     that is no kind of string and the `RangeError` for one that trims to
 *     empty, and returns the unwrapped primitive the freezing writes use.
 *  7. `canOwnNameBeShaped`.
 *  8. the throw-safe `prototype` descriptor read, whose own caught error
 *     becomes the `reason`.
 *  9. `isObjectOrCallable` on the resolved prototype, which is `null` both when
 *     the descriptor held no `value` and when the constructor carried no own
 *     `prototype` descriptor at all.
 *  10.–11. `canOwnPropertyBeShaped`, for the prototype's `constructor` and
 *     then its `Symbol.toStringTag`.
 *  12. the `try` around the three defines, whose caught value becomes the
 *     `reason` — wrapped by `toReportableError` when it is not an error. The
 *     next section says why that is a backstop rather than the primary guard.
 *
 *  ## Why the defines run tag, constructor, name
 *
 *  `name` is written last because it is the irreversible one. Freezing it
 *  closes the slot, so a later failure could not be retried. Running it after
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
export function defineStableTypeIdentity(constructor, constructorName, ...args) {
  if (!isNewableFunction(constructor)) {
    return {
      success: false,
      reason: new TypeError(
        'The provided "constructor" parameter has to be at least a constructable function-type.',
      ),
    };
  }
  if (!isSupportedConstructor(constructor)) {
    return {
      success: false,
      reason: new TypeError(
        'The provided "constructor" parameter needs to be either an ES3 constructor function or a class-syntax constructor. Built-in constructors and bound newables carry neither shape.',
      ),
    };
  }
  // - passing the shape gate means the constructor's own `prototype` descriptor
  //   has already been read once without throwing, through
  //   `hasOwnWritablePrototype` or `hasOwnNonWritablePrototype`. That is
  //   evidence about one past read, not a promise about the next — a Proxy is
  //   free to answer differently each time — which is why the read further
  //   below still routes through the throw-safe helper rather than going direct.

  const verifiedName = getIdentifierAsSafeResult(constructorName, 'constructorName');

  if (verifiedName.error !== null) {
    return {
      success: false,
      reason: verifiedName.error,
    };
  }
  constructorName = verifiedName.value;

  // - presence is decided before validity, and read from the call's ARITY
  //   rather than from the value: an explicitly passed `undefined` is a
  //   supplied argument, not an omitted one. Letting `isString` answer both
  //   questions would instead read every non-string as omitted, so a supplied
  //   `42` would silently become `constructorName` while a `42` in
  //   `constructorName` is refused. That is the conflation ADR #079 ruled
  //   dishonest, in whose own words presence is a property of the CALL. The
  //   rest parameter is what carries the arity — `args.length`, never
  //   `arguments.length`, matching the presence-gated readers in `#utility`
  //   and `#primitive`.

  /** @type {string} */
  let taggedType;

  if (args.length === 0) {
    taggedType = constructorName;
  } else {
    // - the same verification as the name, and the unwrap matters twice over
    //   here: the getter installed below closes over this value, and
    //   `Object.prototype.toString` ignores a tag that is not a primitive
    //   string; and the `taggedType !== constructorName` test that decides the
    //   warning compares wrapper identities rather than text until both sides
    //   are primitives.
    const verifiedTag = getIdentifierAsSafeResult(args[0], 'taggedType');

    if (verifiedTag.error !== null) {
      return {
        success: false,
        reason: verifiedTag.error,
      };
    }
    taggedType = verifiedTag.value;
  }

  if (!canOwnNameBeShaped(constructor)) {
    return {
      success: false,
      reason: new TypeError(
        'The passed constructor\'s "name" property cannot be redefined.',
      ),
    };
  }
  const { error, value } = getOwnPropertyDescriptorAsSafeResult(constructor, 'prototype');

  if (error !== null) {
    return {
      success: false,
      reason: error,
    };
  }
  const prototype = /** @type {object | Callable | null} */ (value?.value ?? null);

  if (!isObjectOrCallable(prototype)) {
    return {
      success: false,
      reason: new TypeError('The passed constructor\'s "prototype" property is invalid.'),
    };
  }
  if (!canOwnPropertyBeShaped(prototype, 'constructor')) {
    return {
      success: false,
      reason: new TypeError(
        'The passed constructor\'s prototypal "constructor" property cannot be redefined.',
      ),
    };
  }
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
 * Pins a callable's own `name` to a given string, so the value survives a
 * minifier that rewrites the identifier the name would otherwise be derived
 * from. The brand does not prevent that rename — it makes the observable `name`
 * independent of it.
 *
 * Re-defines `name` under `frozenEntryDescriptor` — non-enumerable,
 * non-writable, non-configurable. That makes the brand a one-way door: a second
 * call on the same callable is refused, its slot having been frozen by the
 * first.
 *
 * Narrower than {@link defineStableTypeIdentity}, which additionally freezes the
 * prototype's `constructor` and installs the `Symbol.toStringTag` getter. This
 * one touches `name` and nothing else, and admits any callable — a `class`
 * constructor included, and a built-in too. `isCallable` is the only gate here,
 * and no prototype is read, so the shape test that turns a built-in away from
 * the freezing entry has no counterpart. The rename is irreversible on whatever
 * is passed, which is what makes the caller's own functions the intended
 * targets.
 *
 * @param {unknown} fct - the function-type to brand; anything non-callable is
 *  reported as a `reason`
 * @param {string} fctName - the name to brand it with; a boxed `String` is
 *  accepted, unwrapped to its primitive and trimmed
 * @returns {IdentityDefinitionResult} `{ success: true }` once `name` carries
 *  the brand; otherwise `{ success: false, reason }` naming the first condition
 *  that blocked it. Never throws.
 *
 *  ## What decides each rejection
 *
 *  Argument validity is settled before the slot is probed, matching
 *  {@link defineStableTypeIdentity}. The deciders, in order: `isCallable`; then
 *  {@link getIdentifierAsSafeResult} on `fctName`, which decides conditions 2
 *  and 3 together and is the same helper the freezing entry verifies its two
 *  identifiers with; then `canOwnNameBeShaped`. The `try` is the backstop for a
 *  hostile callable that answers the probe truthfully and then refuses the
 *  define. A non-error throw is wrapped and carried as `cause`, so `reason` is
 *  always an error.
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
  const verifiedName = getIdentifierAsSafeResult(fctName, 'fctName');

  if (verifiedName.error !== null) {
    return {
      success: false,
      reason: verifiedName.error,
    };
  }
  fctName = verifiedName.value;

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

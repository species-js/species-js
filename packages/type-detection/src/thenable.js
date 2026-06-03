// @ts-check

/**
 * @module @species-js/type-detection/thenable
 *
 * `Thenable` shaped value detection.
 *
 * The floor predicate {@link isThenable} narrows any value to
 * `Thenable<unknown>` via a descriptor-chain walk that inspects without
 * invoking. {@link isPromise} layers two further structural markers on
 * top — the `[[Class]]` tag and the resolved constructor name — to
 * close `Symbol.toStringTag`-spoofing while staying cross-realm safe.
 */

import { hasInertMethod, getTypeSignature, getDefinedConstructorName } from '@/utility';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('@/thenable').Thenable<unknown>} Thenable */
/** @typedef {import('@/thenable').PromiseLike<unknown>} PromiseLike */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const PromiseConstructor = Promise;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Thenable Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Narrows a value to `Thenable<unknown>` by verifying that `then` is a
 * callable data property reachable through the value's prototype chain.
 *
 * The lookup walks the chain via own-descriptor reads at each level,
 * matching how ECMA-262 `Get(value, "then")` resolves the property
 * during `Promise` adoption. A `then` found anywhere along the chain
 * — own or inherited — satisfies the predicate; native `Promise`
 * instances pass because their `then` lives on `Promise.prototype`.
 *
 * Verifies callability only — it does not validate the `then` signature
 * shape or whether the value honors the `resolve`/`reject` protocol.
 * Accessor descriptors are deliberately rejected: the predicate's
 * contract is to inspect without invoking, so a `get then()` shape is
 * treated as "not a _thenable_ type" even if this very getter returns
 * a callable type.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a _thenable_ type
 * @returns {value is Thenable} `true` when the value carries a callable
 *  `then` data property in its prototype chain, narrowing `value` to
 *  `Thenable<unknown>`; `false` otherwise
 * @example
 * isThenable(Promise.resolve());                   // true (inherited)
 * isThenable({ then: () => {} });                  // true (own)
 * isThenable({ then: 'not a function' });          // false
 * isThenable({ get then() { return () => {}; } }); // false (accessor)
 * isThenable(null);                                // false
 */
export function isThenable(value) {
  return hasInertMethod(value, 'then');
}

/**
 * Verifies that the value matches the `Promise.prototype` method
 * contract — callable `then`, `catch`, and `finally` data properties
 * reachable through the value's prototype chain.
 *
 * Composes three `hasInertMethod` checks for the methods defined on
 * `Promise.prototype` by ECMA-262 §27.2. Short-circuit `&&` enforces
 * an inner cost ordering: `then` (the spec-defined adoption hook) runs
 * first, `catch` second, and `finally` last.
 *
 * Used as the structural fallback inside `isPromiseLike` when the
 * realm-fixed `instanceof PromiseConstructor` fast path fails — for
 * example, on cross-realm `Promise` instances or userland Promise-like
 * implementations such as Bluebird or Q.
 *
 * Does not require `Symbol.toStringTag === 'Promise'` or a particular
 * constructor name; that level of identity narrowing belongs to
 * `isPromise`. `doesMatchPromiseContract` is purely structural.
 *
 * @param {unknown} [value] - the value to inspect; omitted is treated
 *  as `undefined`, which does not match the Promise-method contract
 * @returns {boolean} `true` when all three methods are callable data
 *  properties in the value's prototype chain; `false` otherwise
 * @example
 * doesMatchPromiseContract(Promise.resolve());  // true (inherited from prototype)
 * doesMatchPromiseContract({ then: () => {} }); // false (no `catch` or `finally`)
 * doesMatchPromiseContract(42);                 // false
 * @internal
 */
export function doesMatchPromiseContract(value) {
  return (
    hasInertMethod(value, 'then') &&
    hasInertMethod(value, 'catch') &&
    hasInertMethod(value, 'finally')
  );
}

/**
 * Narrows a value to `PromiseLike<unknown>` via either local-realm
 * `Promise` identity or the structural `Promise.prototype` method
 * contract.
 *
 * Tests in cost order: the inexpensive `instanceof PromiseConstructor`
 * check against the realm-fixed `Promise` capture catches local-realm
 * `Promise` instances and their subclasses in a single prototype walk.
 * If that fails, falls back to `doesMatchPromiseContract` for the structural
 * inspect-without-invoke check — which catches cross-realm `Promise`
 * instances (produced in iframes, workers, vm contexts) and userland
 * _promise-like_ implementations (such as Bluebird or Q) that satisfy
 * the full Promise-method contract.
 *
 * The leading `!!value` guard short-circuits on nullish input before
 * any property work, so neither branch runs for `null` or `undefined`.
 *
 * Cross-realm safe by construction. The `instanceof` branch admits
 * local-realm `Promise` instances on identity; the `doesMatchPromiseContract`
 * branch admits foreign-realm `Promise` instances on structure. No
 * value satisfying the `Promise.prototype` method contract is rejected
 * on realm membership alone.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a _promise-like_ type
 * @returns {value is PromiseLike} `true` when the value is either a
 *  local-realm `Promise` (or subclass) or satisfies the `Promise.prototype`
 *  method contract, narrowing `value` to `PromiseLike<unknown>`; `false`
 *  otherwise
 * @example
 * isPromiseLike(Promise.resolve());                                      // true (instanceof)
 * isPromiseLike({ then: () => {} });                                     // false (no `catch`/`finally`)
 * isPromiseLike({ then: () => {}, catch: () => {}, finally: () => {} }); // true (structural)
 * isPromiseLike(null);                                                   // false
 */
export function isPromiseLike(value) {
  return (
    !!value && (value instanceof PromiseConstructor || doesMatchPromiseContract(value))
  );
}

/**
 * Narrows a value to `Promise<unknown>` via three cross-validating
 * structural markers: the `Promise.prototype` method contract (per
 * {@link isPromiseLike}), the `[[Class]]` tag `'Promise'`, and the
 * constructor name `'Promise'` resolved through the package's
 * constructor walk.
 *
 * Short-circuit `&&` runs the markers in fixed order — `isPromiseLike`
 * gates the tag read, the tag read gates the constructor walk. Each
 * marker is independent and rules out a distinct false-positive class:
 * the `isPromiseLike` gate rejects values that claim Promise identity
 * without satisfying the method contract (e.g., a `Symbol.toStringTag`-
 * tagged object with no `catch` or `finally`); the constructor-name
 * marker rejects values that look right structurally and via tag but
 * whose actual constructor is something other than `Promise`, closing
 * the `Symbol.toStringTag`-spoofing hole the tag check alone would
 * leave open. The common case (native `Promise` in the current realm)
 * settles cheaply on the `instanceof PromiseConstructor` fast path
 * inside `isPromiseLike`.
 *
 * Cross-realm safe. The realm-fixed `instanceof` fast path inside
 * `isPromiseLike` admits local-realm `Promise` instances on identity;
 * its structural fallback (`doesMatchPromiseContract`) admits foreign-realm
 * `Promise` instances on contract. The tag-read and the constructor-walk
 * both work realm-independently. No legitimate `Promise` is rejected
 * on realm membership alone.
 *
 * `Promise` subclasses are rejected. A value of
 * `class MyPromise extends Promise {}` resolves its constructor name
 * to `'MyPromise'`, which fails the equality check against `'Promise'`.
 * This is a deliberate strictness — consumers needing subclass
 * admission should compose with a constructor-chain walk on top of
 * this predicate.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a `Promise`
 * @returns {value is Promise<unknown>} `true` when the value satisfies
 *  all three markers, narrowing `value` to `Promise<unknown>`; `false`
 *  otherwise
 * @example
 * isPromise(Promise.resolve());                                   // true
 * isPromise({ then: () => {} });                                  // false
 * isPromise({ [Symbol.toStringTag]: 'Promise', then: () => {} }); // false (spoof)
 * isPromise(42);                                                  // false
 */
export function isPromise(value) {
  return (
    isPromiseLike(value) &&
    getTypeSignature(value) === '[object Promise]' &&
    getDefinedConstructorName(value) === 'Promise'
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

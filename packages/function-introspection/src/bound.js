// @ts-check

/**
 * @module @species-js/function-introspection/bound
 *
 * Bound-function introspection — what a value produced by
 * `Function.prototype.bind` leaves observable, and what it does not.
 *
 * The defining slot, `[[BoundTargetFunction]]`, is unobservable. Everything
 * reachable is circumstantial: a missing own `prototype`, a preserved
 * `[[Construct]]`, an anonymous `[native code]` source, a `'bound '` name
 * prefix.
 *
 * Both exports share one entrance-level and read the same three marks beyond
 * it; they differ only in how many marks they require. The `doesIndicate`
 * prefix says the answer is evidence rather than proof, and the qualifier says
 * how much evidence stands behind it.
 */

import {
  isFunction,
  hasConstructSlot,
  hasOwnPrototype,
  getVerifiedOwnName,
} from '@species-js/type-detection';

import {
  CONDENSED_NATIVE_SOURCE_FOUNDATION,
  getCondensedFunctionSource,
  doesMatchProxyConstructor,
} from '#utility';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The prefix `Function.prototype.bind` prepends to a bound function's `name`
 * (ECMA-262 §20.2.3.2 — `SetFunctionName(F, targetName, "bound")`).
 *
 * @internal
 */
const BOUND_NAME_PREFIX = 'bound ';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Reports whether the value carries evidence of `Function.prototype.bind`.
 *
 * The entrance-level qualifies a candidate before any mark is read — a verified
 * function with no own `prototype`, which `bind` never grants, so nothing
 * outside that shape can be bound. Past it, three marks are tried in descending
 * reliability and any single one answers `true`:
 *
 * 1. A `[[Construct]]` slot. Beyond the entrance-level only a bound
 *    constructable and the `Proxy` constructor hold one, and `Proxy` is
 *    subtracted by {@link doesMatchProxyConstructor} — so the mark cannot be
 *    produced by ordinary means. It says nothing either way about the bound
 *    forms that were never constructable to begin with.
 * 2. The condensed anonymous native source. The one mark that survives a bound
 *    function whose `name` was overwritten.
 * 3. A `'bound '` prefix on the own `name`. Forgeable — `name` is
 *    `configurable` on every function — and reached only where the first two
 *    miss, which is the engine whose built-ins stringify identically bound or
 *    not (Safari among them).
 *
 * Ordered by decisiveness rather than cost, because any mark ends the question.
 * `hasConstructSlot` allocates a `Proxy` and performs a `new`, making it the
 * most expensive read, but the short-circuit spends it only where it settles
 * the answer outright. {@link doesStronglyIndicateBoundFunction} requires all
 * three and therefore orders them the other way round.
 *
 * Composed entirely from throw-safe readers: `hasOwnPrototype` reads an own
 * descriptor inside a `try`/`catch`, `getVerifiedOwnName` additionally refuses
 * an accessor so a hostile `name` getter is never invoked, and
 * {@link getCondensedFunctionSource} reports `undefined` instead of
 * propagating when the source cannot be read.
 *
 * No `arguments.length` gate is needed: `undefined` is outside the accept set
 * (`isFunction(undefined)` is `false`), so an omitted call is honest by
 * construction.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which carries no bound markers
 * @returns {boolean} `true` when any bound mark beyond the qualifying
 *  entrance-level is present; `false` otherwise
 */
export function doesIndicateBoundFunction(value) {
  return (
    // - minimum entrance-guards
    isFunction(value) &&
    !hasOwnPrototype(value) &&
    // - reliable detection, but does apply just to constructable types
    ((hasConstructSlot(value) && !doesMatchProxyConstructor(value)) ||
      // - strong evidence (BUT, in e.g. Safari there is no difference in
      //   between the bound and un-bound function sources of ANY built-in
      //   function. All these functions need to pass the least reliable
      //   3rd gate of the spoofable "bound " function-name prefix.)
      getCondensedFunctionSource(value) === CONDENSED_NATIVE_SOURCE_FOUNDATION ||
      // - spoofable indicator
      (getVerifiedOwnName(value) ?? '').startsWith(BOUND_NAME_PREFIX))
  );
}

/* @@throw-safe */
/**
 * Reports whether the value carries EVERY bound mark, where
 * {@link doesIndicateBoundFunction} asks for any one of them.
 *
 * The same entrance-level and the same three marks, conjoined instead of
 * cascaded. Requiring all of them closes two boundaries the cascade documents
 * as accepted: `Function.prototype`, which is genuinely anonymous and native
 * but carries no `'bound '` name, and any prototype-less callable merely
 * renamed to look bound, whose source is still its own text.
 *
 * The `[[Construct]]` mark is applied conditionally rather than required. A
 * bound arrow or bound concise method has no construct slot, so demanding one
 * would reject half the bound forms; what the clause contributes here is the
 * `Proxy` subtraction, which only bites where a slot exists.
 *
 * Ordered cheapest-first, the opposite of the cascade and for the mirrored
 * reason: a conjunction ends at the first mark that FAILS, so the two
 * descriptor reads run before the string allocation, and the `Proxy`-allocating
 * construct probe runs last.
 *
 * Recall is the price. A genuine bound function whose `name` was overwritten is
 * reported `false`, and so is any bound value on an engine that keeps a name in
 * the native source form — both of which the cascade still catches. This
 * variant degrades to silence; the cascade degrades to a weaker answer.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which carries no bound markers
 * @returns {boolean} `true` when every bound mark (in addition to the
 *  qualifying entrance-level) is present; `false` otherwise
 */
export function doesStronglyIndicateBoundFunction(value) {
  return (
    // - minimum entrance-guards
    isFunction(value) &&
    !hasOwnPrototype(value) &&
    // - spoofable indicator
    (getVerifiedOwnName(value) ?? '').startsWith(BOUND_NAME_PREFIX) &&
    // - strong evidence (BUT, in e.g. Safari there is no difference in between
    //   the bound and un-bound function sources of ANY built-in function.
    //   Here that costs RECALL rather than precision: this predicate requires
    //   every mark, so those functions simply fail it — there is no weaker
    //   gate left to fall through to.)
    getCondensedFunctionSource(value) === CONDENSED_NATIVE_SOURCE_FOUNDATION &&
    // - reliable detection, but does apply just to constructable types
    (hasConstructSlot(value) ? !doesMatchProxyConstructor(value) : true)
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

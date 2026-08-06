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
 * prefix. This module reads those marks and reports what they add up to; the
 * `doesIndicate` prefix on the export says how far that answer travels.
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
 * Two structural facts gate every branch — the value is a verified function,
 * and it has no own `prototype`. `bind` never grants one, so nothing outside
 * that shape can be bound. Past the gate three marks are tried in descending
 * reliability, and any single one answers `true`:
 *
 * 1. A `[[Construct]]` slot with no own `prototype`. Only a bound constructable
 *    and the `Proxy` constructor hold that pair, and `Proxy` is subtracted by
 *    {@link doesMatchProxyConstructor} — so within this gate the mark cannot be
 *    produced by ordinary means.
 * 2. The condensed anonymous native source. The one mark that survives a bound
 *    function whose `name` was overwritten.
 * 3. A `'bound '` prefix on the own `name`. Forgeable — `name` is
 *    `configurable` on every function — and reached only where the first two
 *    miss, which is the engine whose built-ins stringify identically bound or
 *    not (Safari among them).
 *
 * Ordered by decisiveness rather than cost. `hasConstructSlot` allocates a
 * `Proxy` and performs a `new`, making it the most expensive mark, but the
 * short-circuit spends it only where it settles the question outright.
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
 * @returns {boolean} `true` when any bound mark is present; `false` otherwise
 */
export function doesIndicateBoundFunction(value) {
  return (
    isFunction(value) &&
    !hasOwnPrototype(value) &&
    // - reliable detection
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

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// @ts-check

/**
 * @module test/_cross-realm
 *
 * Foreign-realm access for the axis-2 suites, in two forms.
 *
 * A Node `vm` context is a separate realm: its `Object`, `Error`, `Array`, …
 * intrinsics are distinct objects from this realm's, so `instanceof` against a
 * local constructor answers `false` for a value produced inside it. That is the
 * condition this package exists for — its reads are descriptor reads, so they
 * have no realm dependence to lose — and a `vm` context is the cheapest place
 * to demonstrate it.
 *
 * {@link foreignRealmEval} shares ONE long-lived realm across the suites, the
 * convention type-detection and function-introspection already follow.
 * {@link createForeignRealm} hands back a private one.
 *
 * The private form is not a convenience. Two of this package's operations
 * are one-way doors — a frozen `name` can never be reshaped, and
 * `brandFunctionName` admits a built-in (`brand/B1`) — so a vector that brands
 * a foreign `Math.max` renames it for the rest of the process. Run against the
 * shared realm it would contaminate every later fixture drawn from there; run
 * against a private one it cannot reach anything. The isolation is asserted
 * rather than assumed: the branding vector reads this realm's `Math.max.name`
 * back afterward.
 */

import { createContext, runInContext } from 'node:vm';

// One long-lived foreign realm, shared by every vector that only needs a value
// of foreign origin. The vm installs the standard intrinsics into the sandbox.
const sharedRealm = createContext({});

/**
 * Evaluates an expression inside the shared foreign realm.
 *
 * @param {string} expression - a JavaScript expression evaluated in the shared
 *  foreign realm (e.g. `'Array'`)
 * @returns {unknown} the value produced inside that realm
 */
export function foreignRealmEval(expression) {
  return /** @type {unknown} */ (runInContext(expression, sharedRealm));
}

/**
 * Creates a private foreign realm and returns its evaluator.
 *
 * For vectors whose effect is permanent, and for the ones that need to read a
 * value back from INSIDE the realm after this realm has written to it — which
 * needs somewhere in that realm to keep the handle.
 *
 * @returns {(expression: string) => unknown} an evaluator bound to a fresh realm
 */
export function createForeignRealm() {
  const realm = createContext({});

  return (expression) => /** @type {unknown} */ (runInContext(expression, realm));
}

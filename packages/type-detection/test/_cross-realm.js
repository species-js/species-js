// @ts-check

/**
 * @module test/_cross-realm
 *
 * Shared cross-realm (foreign-realm) fixture factory for the axis-2 suites.
 *
 * A Node `vm` context is a separate realm: its `Promise`, `Error`, `Array`,
 * `String`, … intrinsics are distinct objects from this realm's, so
 * `instanceof` against a local constructor returns `false` for a value
 * produced inside it — exactly the condition the package's structural
 * (realm-independent) detection arms must handle.
 *
 * Each module's `_helpers.js` composes `foreignRealmEval` into the specific
 * foreign values its cross-realm vectors name. This file owns only the realm;
 * the domain values live next to the tests that use them, so a change to one
 * module's fixtures cannot ripple into another's.
 */

import { createContext, runInContext } from 'node:vm';

// One long-lived foreign realm shared across all axis-2 suites. The vm
// installs the standard intrinsics (`Promise`, `Error`, …) into the sandbox.
const foreignRealm = createContext({});

/**
 * Evaluates a source expression inside the shared foreign realm and returns
 * the resulting foreign-realm value.
 *
 * @param {string} expression - a JavaScript expression evaluated in the
 *  foreign realm (e.g. `'Promise.resolve(1)'`)
 * @returns {unknown} the value produced inside the foreign realm
 */
export function foreignRealmEval(expression) {
  return /** @type {unknown} */ (runInContext(expression, foreignRealm));
}

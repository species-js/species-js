// @ts-check

/**
 * @module test/_cross-realm
 *
 * Shared cross-realm (foreign-realm) fixture factory for the axis-2 suites.
 *
 * A Node `vm` context is a separate realm: its `Proxy`, `Function`, `Object`, …
 * intrinsics are distinct objects from this realm's. That is the condition the
 * `bound` module's `Proxy` subtraction has to survive — `doesMatchProxyConstructor`
 * compares against this realm's capture by identity first, so a foreign `Proxy`
 * can only be recognised by the structural arm.
 *
 * Each module's fixtures compose `foreignRealmEval` into the specific foreign
 * values its vectors name. This file owns only the realm.
 */

import { createContext, runInContext } from 'node:vm';

// One long-lived foreign realm shared across the axis-2 suites.
const foreignRealm = createContext({});

/**
 * Evaluates a source expression inside the shared foreign realm and returns the
 * resulting foreign-realm value.
 *
 * @param {string} expression - a JavaScript expression evaluated in the foreign
 *  realm
 * @returns {unknown} the value the expression produced, owned by that realm
 */
export function foreignRealmEval(expression) {
  return runInContext(expression, foreignRealm);
}

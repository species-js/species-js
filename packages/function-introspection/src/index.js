// @ts-check

/**
 * @module @species-js/function-introspection
 *
 * Function classification and structural introspection
 * for JavaScript callables.
 *
 * Aggregates the package's per-domain subpaths into a single import surface.
 * Consumers may import either from the root
 * (`@species-js/function-introspection`) or from a specific subdomain.
 * Subpaths:
 *
 * - `@species-js/function-introspection/bound` — what
 *   `Function.prototype.bind` leaves observable on its result.
 *
 * ## Trust travels in the name
 *
 * This package hosts the classifications type-detection declines: terminal
 * questions rather than load-bearing ones, and some of them answerable only
 * from evidence a determined caller can forge. That distinction is carried by
 * the identifier and nowhere else.
 *
 * A `doesIndicate…` export answers "does the value carry each mark of X",
 * never "is the value X", and returns a plain `boolean`. Withholding the type
 * guard is deliberate: a `value is X` signature makes the compiler treat the
 * narrowing as settled, and forgeable evidence does not earn that. A caller
 * who wants the narrow writes the assertion, where the trust is theirs to
 * extend. It also keeps the boundary honest structurally — a predicate that
 * narrows nothing cannot be composed from in a type-safe chain, so it can
 * never quietly become foundation.
 *
 * Modules are named for their subject, never for their trust grade. A grade
 * in a filename would be a second carrier of something the identifier already
 * says, and one that can drift from it.
 *
 * `#utility` is deliberately absent below. A module whose exports are public
 * throughout is star-re-exported; one that merely contains some is not, and
 * the barrel names what escapes — `@internal` is a documentation tag no
 * resolver enforces, so a star would publish the module whatever its tagging
 * claims.
 */

export * from '#bound';

export { getCondensedFunctionSource } from '#utility';

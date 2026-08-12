// @ts-check

/**
 * @module @species-js/function-introspection
 *
 * Function classification and structural introspection for JavaScript
 * callables.
 *
 * The package's WIDE barrel. It stars every module, so it carries the
 * `@internal` machinery along with the public predicates — `#index` is what
 * the test suites import, and narrowing it would break them. The PUBLISHED
 * root is the curated `src/public.js`, which names its exports one by one and
 * is what `exports["."]` resolves to.
 *
 * Each module is also published as a subpath of its own:
 *
 * - `@species-js/function-introspection/utility` — the function-source
 *   readers and `Proxy` constructor recognizers the predicates share; mostly
 *   `@internal`.
 * - `@species-js/function-introspection/bound` — what
 *   `Function.prototype.bind` leaves observable on its result.
 * - `@species-js/function-introspection/arrow` — arrow functions of either
 *   flavor, told apart from the concise methods they resemble.
 * - `@species-js/function-introspection/concise` — which shorthand method
 *   definition, if any, a function came from.
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
 */

export * from '#utility';
export * from '#bound';
export * from '#arrow';
export * from '#concise';

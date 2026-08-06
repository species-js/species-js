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

/* @@throw-safe */
/**
 * Reports whether the value carries evidence of `Function.prototype.bind`.
 *
 * Two structural facts gate every branch — the value is a function, and it has
 * no own `prototype`, which `bind` never grants. Past that gate, three marks
 * are tried in descending reliability and any single one answers `true`:
 *
 * 1. **A `[[Construct]]` slot with no own `prototype`.** Only a bound
 *    constructable and the `Proxy` constructor hold that pair, and `Proxy` is
 *    subtracted, so ordinary code cannot produce this mark.
 * 2. **The anonymous `[native code]` source.** Compared after whitespace
 *    condensing, which makes it engine-independent. The only mark that
 *    survives a bound function whose `name` was overwritten.
 * 3. **A `'bound '` prefix on the own `name`.** Forgeable, and reached only
 *    where the first two miss — the engines whose built-ins stringify
 *    identically whether bound or not.
 *
 * ## Boundaries
 *
 * - **A `Proxy` is reported as bound.** Any prototype-less callable wrapped in
 *   a bare `Proxy` satisfies mark 2, because a `Proxy` has no `[[SourceText]]`
 *   slot and so stringifies to the same anonymous native form a bound function
 *   does. No handler or forgery is involved, and no source-based test can
 *   separate the two.
 * - **`Function.prototype` is reported as bound.** It is genuinely anonymous
 *   and genuinely native, so it satisfies mark 2 on its own terms.
 * - **Mark 3 admits a rename.** Any prototype-less callable — an arrow, a
 *   concise method — whose `name` is redefined to start with `'bound '` is
 *   reported as bound. `name` is `configurable` on every function.
 * - **Says nothing about the target.** The bound target function, its `this`
 *   binding, and its partially applied arguments live in internal slots with
 *   no observable channel.
 *
 * The reliable tell — `[[BoundTargetFunction]]` — is unobservable, which is
 * why this answer is evidence rather than proof and why the return type grants
 * no narrowing.
 *
 * @example
 * ```ts
 * function greet(greeting: string, name: string) {}
 *
 * doesIndicateBoundFunction(greet.bind(null, 'Hello')); // true
 * doesIndicateBoundFunction(Math.max.bind(null)); // true
 * doesIndicateBoundFunction(greet); // false
 * doesIndicateBoundFunction(Math.max); // false — native, but unbound
 * doesIndicateBoundFunction(() => {}); // false
 * doesIndicateBoundFunction(undefined); // false
 *
 * doesIndicateBoundFunction(new Proxy(() => {}, {})); // true — a documented boundary
 * ```
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  carries no bound markers
 * @returns `true` when any bound mark is present; `false` otherwise
 */
export function doesIndicateBoundFunction(value?: unknown): boolean;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

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

/* @@throw-safe */
/**
 * Reports whether the value carries evidence of `Function.prototype.bind`.
 *
 * An entrance-level qualifies a candidate before any mark is read — the value
 * is a function, and it has no own `prototype`, which `bind` never grants. Past
 * it, three marks are tried in descending reliability and any single one
 * answers `true`:
 *
 * 1. **A `[[Construct]]` slot.** Beyond the entrance-level only a bound
 *    constructable and the `Proxy` constructor hold one, and `Proxy` is
 *    subtracted, so ordinary code cannot produce this mark. It says nothing
 *    either way about bound forms that were never constructable.
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
 * {@link doesStronglyIndicateBoundFunction} closes the second and third of
 * those by requiring every mark, at a cost in recall. The first survives both:
 * it is structural, not a matter of how many marks are demanded.
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
 * @returns `true` when any bound mark beyond the qualifying entrance-level is
 *  present; `false` otherwise
 */
export function doesIndicateBoundFunction(value?: unknown): boolean;

/* @@throw-safe */
/**
 * Reports whether the value carries EVERY bound mark, where
 * {@link doesIndicateBoundFunction} asks for any one of them.
 *
 * The same entrance-level and the same three marks, conjoined rather than
 * cascaded, which trades recall for precision. Reach for this one when a false
 * positive costs more than a miss; reach for the cascade when a miss costs
 * more.
 *
 * The `[[Construct]]` mark is applied conditionally rather than required — a
 * bound arrow or bound concise method never had a construct slot, so demanding
 * one would reject half the bound forms. What it contributes here is the
 * `Proxy` subtraction, which only bites where a slot exists.
 *
 * ## What the conjunction closes
 *
 * - **`Function.prototype`** — anonymous and native, but its `name` is empty, so
 *   it no longer passes.
 * - **A renamed prototype-less callable** — an arrow or concise method whose
 *   `name` was redefined to start with `'bound '` still stringifies as its own
 *   source, so it no longer passes.
 *
 * ## What it costs, and what still defeats it
 *
 * - **A genuine bound function whose `name` was overwritten** is reported
 *   `false`; `name` is `configurable` on every function.
 * - **Engines that keep a name in the native source form** report `false` for
 *   the bound values affected. This variant degrades to silence where the
 *   cascade degrades to a weaker answer.
 * - **A `Proxy` that also forges its `name` still passes.** A bare `Proxy` does
 *   not: it satisfies mark 2 for free — no `[[SourceText]]` slot, so it produces
 *   the anonymous native source honestly — but forwards the target's `name`,
 *   which fails mark 3. Add a `get`/`getOwnPropertyDescriptor` trap reporting a
 *   `'bound …'` name and every mark is satisfied. So the conjunction raises the
 *   cost of forgery from one `defineProperty` to an exotic object with a
 *   handler, without ever making it impossible — which is why this is still a
 *   `doesIndicate…` predicate returning a plain `boolean`, and why no variant of
 *   it may be named `is…`.
 *
 * @example
 * ```ts
 * function greet(greeting: string, name: string) {}
 *
 * doesStronglyIndicateBoundFunction(greet.bind(null, 'Hello')); // true
 * doesStronglyIndicateBoundFunction(Math.max.bind(null)); // true
 * doesStronglyIndicateBoundFunction(Function.prototype); // false — the cascade says true
 * doesStronglyIndicateBoundFunction(greet); // false
 * doesStronglyIndicateBoundFunction(undefined); // false
 *
 * doesStronglyIndicateBoundFunction(new Proxy(() => {}, {})); // false — the cascade says true
 * ```
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  carries no bound markers
 * @returns `true` when every bound mark (in addition to the qualifying
 *  entrance-level) is present; `false` otherwise
 */
export function doesStronglyIndicateBoundFunction(value?: unknown): boolean;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

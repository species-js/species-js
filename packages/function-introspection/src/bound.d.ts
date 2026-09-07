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
 * Both predicates share one entrance-level, and the `doesIndicate` prefix says
 * the answer is evidence rather than proof. What separates them is whether they
 * read the function source.
 *
 * {@link doesIndicateBoundFunction} does not. Its two marks are both specified
 * by the language, so it answers identically on every conforming engine — a
 * contract a consumer can rely on without knowing which browser they are in.
 *
 * {@link doesStronglyIndicateBoundFunction} does, and buys precision with
 * portability. `Function.prototype.toString` is implementation-defined for an
 * exotic: JavaScriptCore — Safari, and every browser on iOS — renders a bound
 * function's target name where V8 and SpiderMonkey render nothing. It is
 * therefore selected between two implementations by
 * {@link hasJavaScriptCoreBindBehavior}, and may answer differently on Safari
 * than on Chrome for the same value. That is deliberate: each realm is answered
 * with the evidence it actually exposes.
 */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Reports whether the value carries evidence of `Function.prototype.bind`.
 *
 * An entrance-level qualifies a candidate before any mark is read — the value
 * is a function, and it has no own `prototype`, which `bind` never grants. Past
 * it, two marks are tried and either one answers `true`:
 *
 * 1. **A `[[Construct]]` slot.** Beyond the entrance-level only a bound
 *    constructable and the `Proxy` constructor hold one, and `Proxy` is
 *    subtracted, so ordinary code cannot produce this mark. It says nothing
 *    either way about bound forms that were never constructable.
 * 2. **A `'bound '` prefix on the own `name`.** Forgeable, since `name` is
 *    `configurable` on every function, and it carries most of the answers.
 *
 * ## The same answer in every engine
 *
 * Both marks are specified by the language: `bind` grants the construct slot
 * when its target is a constructor, and it always prefixes the name. Nothing
 * here reads the function source, which is the one thing engines spell
 * differently — `Function.prototype.toString` is implementation-defined for an
 * exotic, and JavaScriptCore puts the bound target's name where V8 and
 * SpiderMonkey put nothing.
 *
 * So this predicate answers identically on every conforming engine, including
 * ones nobody has tested it on. {@link doesStronglyIndicateBoundFunction} does
 * read the source, and is realm-aware in exchange for the extra precision.
 *
 * ## Boundaries
 *
 * - **A rename is admitted.** Any prototype-less callable — an arrow, a concise
 *   method — whose `name` is redefined to start with `'bound '` is reported as
 *   bound. `name` is `configurable` on every function, so the second mark is
 *   forgeable by design.
 * - **A `Proxy` is admitted when it forwards a bound name.** Wrapping a bound
 *   function in a `Proxy` keeps the `'bound …'` name visible, and the thing
 *   behind the proxy really is bound. A `Proxy` over an UNBOUND callable is
 *   rejected, because it forwards that target's ordinary name.
 * - **Erasing the name erases the answer.** A bound arrow, concise method or
 *   generator whose `name` was overwritten is reported `false` — nothing is
 *   left to read. A bound ordinary function or class survives it, because the
 *   construct slot is not a name.
 *   {@link doesStronglyIndicateBoundFunction} misses both.
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
 * doesIndicateBoundFunction(new Proxy(() => {}, {})); // false — never bound
 * doesIndicateBoundFunction(new Proxy(greet.bind(null), {})); // true
 * ```
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  carries no bound markers
 * @returns `true` when either bound mark beyond the qualifying entrance-level
 *  is present; `false` otherwise
 */
export function doesIndicateBoundFunction(value?: unknown): boolean;

/* @@throw-safe */
/**
 * Reports whether the value carries EVERY bound mark, where
 * {@link doesIndicateBoundFunction} asks for any one of them.
 *
 * The same entrance-level, plus a third mark the cascade does not read: the
 * function's own source. Requiring all three trades recall for precision, and
 * portability with it. Reach for this one when a false positive costs more than
 * a miss and the answer may differ by engine; reach for the cascade when a miss
 * costs more, or when the same answer everywhere matters more than the extra
 * precision.
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
 *   `false`; `name` is `configurable` on every function. This variant degrades
 *   to silence where the cascade degrades to a weaker answer.
 * - **On JavaScriptCore the admitted set is not the same one.** There the
 *   expected native source is reconstructed from the `'bound '`-prefixed name
 *   rather than compared against the anonymous form, which is the only reading
 *   that can fire on that engine. It admits the same bound values, and it
 *   additionally admits a **native built-in renamed to look bound** — on that
 *   engine such a value is indistinguishable from a genuinely bound built-in,
 *   so no reading can separate them. A renamed user function is still rejected
 *   on every engine.
 * - **A `Proxy` that also forges its `name` still passes.** A bare `Proxy` does
 *   not. It satisfies mark 2 for free: with no `[[SourceText]]` slot it
 *   produces the anonymous native source honestly. But it forwards the
 *   target's `name`, which fails mark 3. Add a
 *   `get`/`getOwnPropertyDescriptor` trap reporting a `'bound …'` name and
 *   every mark is satisfied. So the conjunction raises the cost of forgery
 *   from one `defineProperty` to an exotic object with a handler. It never
 *   makes forgery impossible. That is why this stays a `doesIndicate…`
 *   predicate returning a plain `boolean`, and why no variant of it may be
 *   named `is…`.
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
//
//  Engine Reading of Mark 2
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Reports whether this realm keeps the target's name in the native source form
 * of a bound function — the JavaScriptCore behavior, and what selects between
 * the two implementations of {@link doesStronglyIndicateBoundFunction}.
 *
 * Reads a property of the realm, not of a value, so it takes no argument. The
 * probe runs on the first call and the answer is memoized.
 *
 * A consumer needs this to interpret a strong answer, to skip a fixture whose
 * expectation is engine-specific, or to assert an engine's reading in a smoke
 * test. It cannot be forged upward: a replaced `parseInt` makes it report
 * `false`, selecting the stricter reading.
 *
 * @example
 * ```ts
 * // Safari / iOS: true — Chrome, Firefox, Node: false
 * hasJavaScriptCoreBindBehavior();
 * ```
 *
 * @returns `true` when this realm renders a bound function's target name into
 *  the native source form
 */
export function hasJavaScriptCoreBindBehavior(): boolean;

/* @@throw-safe */
/**
 * The conjunction as an engine that renders the target's name must read it —
 * mark 2 reconstructed from the own `name` rather than compared against the
 * anonymous form.
 *
 * Exposed for testing and for a smoke probe that must exercise a reading its
 * host engine does not select. Consumers call
 * {@link doesStronglyIndicateBoundFunction}, which resolves to this or to
 * {@link doesStronglyIndicateNonJSCBoundFunction} for the running realm.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  carries no bound markers
 * @returns `true` when every bound mark (in addition to the qualifying
 *  entrance-level) is present; `false` otherwise
 *
 * @internal
 */
export function doesStronglyIndicateJSCSpecificBoundFunction(value?: unknown): boolean;

/* @@throw-safe */
/**
 * The conjunction as an engine that renders a bound function anonymously reads
 * it — mark 2 compared against `CONDENSED_NATIVE_SOURCE_FOUNDATION`.
 *
 * Exposed on the same terms as
 * {@link doesStronglyIndicateJSCSpecificBoundFunction}.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  carries no bound markers
 * @returns `true` when every bound mark (in addition to the qualifying
 *  entrance-level) is present; `false` otherwise
 *
 * @internal
 */
export function doesStronglyIndicateNonJSCBoundFunction(value?: unknown): boolean;

/* @@throw-safe */
/**
 * Assembles the condensed native source a JavaScriptCore engine renders for a
 * bound function, from the `'bound '`-prefixed own `name` it derives that form
 * from.
 *
 * Strips exactly one prefix, so a double-bound name yields the target's own
 * bound form. An empty remainder means an anonymous target, which every engine
 * renders anonymously, so that case yields the anonymous foundation.
 *
 * @param boundName - a `name` of the form `bound ${targetName}`
 * @returns the condensed source to compare a candidate's against
 *
 * @internal
 */
export function createExpectedJSCSpecificFunctionSourceFromBoundName(
  boundName: string,
): string;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

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
 * Both predicates share one entrance-level, and the `doesIndicate` prefix says
 * the answer is evidence rather than proof. Beyond that they now differ in kind
 * rather than in degree, and the difference is the function source.
 *
 * The cascade never reads it. Both marks it does read are specified by the
 * language — `bind` grants a construct slot when its target is a constructor,
 * and it always prefixes the name with `'bound '` — so the cascade answers the
 * same in every engine by derivation. That is a contract a consumer can rely on
 * without asking which browser they are in (ADR #100).
 *
 * The conjunction does read it, and pays the engine's price for the extra
 * precision. `Function.prototype.toString` is implementation-defined for an
 * exotic: JavaScriptCore puts the bound target's name where V8 and SpiderMonkey
 * put nothing, so a single equality cannot serve both. It is therefore built
 * twice and dispatched per call through {@link hasJavaScriptCoreBindBehavior},
 * whose own answer is probed once and memoized. Nothing here runs at evaluation
 * time.
 *
 * So one predicate is portable and one is realm-aware, deliberately. Making the
 * strong one uniform would mean discarding evidence an engine really offers;
 * making the cascade realm-aware bought nothing but ambiguity.
 */

import {
  getVerifiedOwnName,
  isFunction,
  hasConstructSlot,
  hasOwnPrototype,
} from '@species-js/type-detection';

import {
  CONDENSED_NATIVE_SOURCE_FOUNDATION,
  getCondensedFunctionSource,
  doesMatchProxyConstructor,
} from '#utility';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('@species-js/type-detection').Callable} Callable */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The prefix `Function.prototype.bind` prepends to a bound function's `name`
 * (ECMA-262 §20.2.3.2 — `SetFunctionName(F, targetName, "bound")`).
 *
 * @internal
 */
const BOUND_NAME_PREFIX = 'bound ';

/**
 * The offset at which a bound `name`'s target portion begins — derived from
 * {@link BOUND_NAME_PREFIX} rather than written as a literal, so the two cannot
 * drift apart.
 *
 * Read where exactly ONE prefix is stripped from a `name` already known to
 * carry it. A double-bound `'bound bound plain'` therefore yields
 * `'bound plain'`, its target's own bound name, which is what a name-rendering
 * engine puts in the native source form — measured on WebKit 26.5, where
 * `named.bind(null).bind(null)` renders `function bound namedFunction(){[native
 * code]}` (probe A8).
 *
 * @internal
 */
const BOUND_NAME_PREFIX_LENGTH = BOUND_NAME_PREFIX.length;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Runs the realm probe once, unmemoized — the body
 * {@link hasJavaScriptCoreBindBehavior} caches.
 *
 * Asks the one question that separates the two readings: does this realm render
 * a bound function's TARGET NAME into the native source form? A local function
 * is bound and the two forms compared, so the answer comes from the engine and
 * from nothing a caller can reach.
 *
 * No name is written as a literal. The minifier renames `probeTarget` —
 * measured: esbuild emits `function n(){}` for it in the UMD build — so every
 * expectation is DERIVED from the probe's own `name` at call time. A literal
 * would compare the built artifact against a name only the source carries,
 * answer `false` on every engine there, and silently select the reading
 * JavaScriptCore cannot use. Nothing local would catch that: on V8 a broken
 * probe and a working one both answer `false`.
 *
 * A DECLARATION rather than a function expression, for the same reason measured
 * one step further. esbuild keeps a declaration's name in `[[SourceText]]`,
 * while an expression assigned to a `const` keeps only the `name` property and
 * renders anonymously — which would leave the first clause below comparing two
 * strings that cannot differ.
 *
 * The three clauses are one string read twice. The UNBOUND probe must not
 * render as that form, which proves the source reader separates authored text
 * from a native one; without it, a reader returning the native form for
 * everything would INDUCE the JavaScriptCore reading on an engine unable to use
 * it, and inducing is the dangerous direction — it is what admits the renamed
 * native. The BOUND probe must then carry the `'bound '` prefix and render as
 * exactly that form.
 *
 * Reads no global. The probe is closure-local and never escapes, so unlike a
 * `globalThis` property there is nothing a script running earlier could replace
 * or trap. The `try` stays because the composed readers are contracted
 * throw-safe rather than proven so against every host.
 *
 * @returns {boolean} `true` when this realm renders a bound function's target
 *  name into the native source form
 *
 * @internal
 */
function doesRealmKeepBoundTargetName() {
  try {
    function probeTarget() {
      /* the head is all that is read; the body only has to be legal */
    }

    const probeName = getVerifiedOwnName(probeTarget);

    // unreachable for a declaration, which the grammar always names — but
    // `getVerifiedOwnName` is typed `string | undefined`, and an unnarrowed
    // `undefined` would be interpolated into the expectations below as text
    if (!probeName) {
      return false;
    }
    const boundProbe = /** @type {Callable} */ (probeTarget.bind(null));
    const namedNativeForm = `function ${probeName}(){[native code]}`;

    return (
      getCondensedFunctionSource(probeTarget) !== namedNativeForm &&
      getVerifiedOwnName(boundProbe) === `${BOUND_NAME_PREFIX}${probeName}` &&
      getCondensedFunctionSource(boundProbe) === namedNativeForm
    );
  } catch {
    return false;
  }
}

/**
 * Reports whether this realm keeps the target's name in the native source form
 * of a bound function — the JavaScriptCore behavior, and the reason
 * {@link doesStronglyIndicateBoundFunction} exists in two implementations.
 *
 * Reads a realm property, not a value, so it takes no argument. Lazy and
 * memoized behind a closure: {@link doesRealmKeepBoundTargetName} runs on the
 * first call and the answer is reused, since a `bind` plus two source reads per
 * predicate call would cost more than every mark it guards. Nothing runs at
 * module-eval time — the module evaluates without touching the global object.
 *
 * The cache is filled by a nullish coalesce around an assignment rather than by
 * the logical-assignment operator, which is ES2021 and reaches the built
 * artifact unlowered — `smoke:check` rejects it against the ES2020 floor
 * `engines.node` promises. This spelling satisfies that floor and
 * `prefer-nullish-coalescing` at once, where an explicit `undefined` check
 * satisfies only the first.
 */
export const hasJavaScriptCoreBindBehavior = (() => {
  /** @type {boolean | undefined} */
  let indication;

  return () => {
    return indication ?? (indication = doesRealmKeepBoundTargetName());
  };
})();

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Reports whether the value carries evidence of `Function.prototype.bind`.
 *
 * The entrance-level qualifies a candidate before any mark is read — a verified
 * function with no own `prototype`, which `bind` never grants, so nothing
 * outside that shape can be bound. Past it, two marks are tried and either one
 * answers `true`:
 *
 * 1. A `[[Construct]]` slot. Beyond the entrance-level only a bound
 *    constructable and the `Proxy` constructor hold one, and `Proxy` is
 *    subtracted by {@link doesMatchProxyConstructor} — so the mark cannot be
 *    produced by ordinary means. It says nothing either way about the bound
 *    forms that were never constructable to begin with.
 * 2. A `'bound '` prefix on the own `name`. Forgeable, since `name` is
 *    `configurable` on every function, and it carries most of the answers.
 *
 * ## Why the native source form is not a third mark
 *
 * Reading it would ask whether the value stringifies as an anonymous native
 * function. Bound functions do — but so does every callable `Proxy`, and so
 * does `Function.prototype`. It tests for an exotic callable without source
 * text, which is a strictly larger set than "bound", so as a positive mark it
 * admits values that were never bound at all (ADR #100).
 *
 * It also cannot be read the same way everywhere. `Function.prototype.toString`
 * is implementation-defined for an exotic, and JavaScriptCore puts the bound
 * target's name where V8 and SpiderMonkey put nothing. It was the only
 * engine-dependent input this predicate had.
 *
 * Both surviving marks come from the specification instead — `bind` grants the
 * construct slot when its target is a constructor, and it always prefixes the
 * name. So this answer is the same in every engine by derivation, not because
 * three of them were measured and agreed.
 *
 * The price is one case, and a narrow one: a bound arrow, concise method,
 * generator or non-constructable native whose `name` was overwritten is now
 * reported `false`. A bound ordinary function or class survives the same
 * erasure, because it keeps its construct slot and mark 1 still reaches it.
 * The lost case was only ever caught where the engine rendered anonymously, so
 * it never held on Safari, and a caller who erases the evidence now gets an
 * answer that says so.
 *
 * Ordered by decisiveness rather than cost, because either mark ends the
 * question. `hasConstructSlot` allocates a `Proxy` and performs a `new`, making
 * it the more expensive read, but the short-circuit spends it only where it
 * settles the answer outright. {@link doesStronglyIndicateBoundFunction} keeps
 * all three marks and orders them the other way round.
 *
 * Composed entirely from throw-safe readers. `hasOwnPrototype` reads an own
 * descriptor inside a `try`/`catch`, and `getVerifiedOwnName` refuses an
 * accessor, so a hostile `name` getter is never invoked. No source is read at
 * all, which removes the last reader that could differ by engine.
 *
 * No `arguments.length` gate is needed: `undefined` is outside the accept set
 * (`isFunction(undefined)` is `false`), so an omitted call is honest by
 * construction.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which carries no bound markers
 * @returns {boolean} `true` when either bound mark beyond the qualifying
 *  entrance-level is present; `false` otherwise
 */
export function doesIndicateBoundFunction(value) {
  return (
    // - minimum entrance-guards
    isFunction(value) &&
    !hasOwnPrototype(value) &&
    // - reliable detection, but does apply just to constructable types
    ((hasConstructSlot(value) && !doesMatchProxyConstructor(value)) ||
      // - spoofable indicator, and the only one left: the native source form
      //   is deliberately NOT read here (ADR #100)
      (getVerifiedOwnName(value) ?? '').startsWith(BOUND_NAME_PREFIX))
  );
}

/* @@throw-safe */
/**
 * Assembles the condensed native source a JavaScriptCore engine renders for a
 * bound function, from the `'bound '`-prefixed own `name` that engine derives
 * it from.
 *
 * Strips exactly one prefix, so a double-bound `'bound bound plain'` yields the
 * target's own bound form, `'function bound plain(){[native code]}'`. An empty
 * remainder means an anonymous target, which every engine renders anonymously,
 * so that case collapses onto {@link CONDENSED_NATIVE_SOURCE_FOUNDATION}
 * instead of leaving a space where the name would be.
 *
 * @param {string} boundName - exclusively a string-value of following form
 *  `bound ${function-name-before-bind}`
 * @returns {string} the condensed source to compare a candidate's against
 *
 * @internal
 */
export function createExpectedJSCSpecificFunctionSourceFromBoundName(boundName) {
  const preBoundName = boundName.slice(BOUND_NAME_PREFIX_LENGTH);

  return preBoundName === ''
    ? CONDENSED_NATIVE_SOURCE_FOUNDATION
    : `function ${preBoundName}(){[native code]}`;
}

/* @@throw-safe */
/**
 * The conjunction as an engine that renders the target's name must read it —
 * {@link doesStronglyIndicateBoundFunction}'s implementation wherever
 * {@link hasJavaScriptCoreBindBehavior} holds.
 *
 * The same entrance-level and the same three marks as
 * {@link doesStronglyIndicateNonJSCBoundFunction}, differing in mark 2 alone.
 * A comparison against the anonymous foundation cannot fire on such an engine,
 * so the expected source is RECONSTRUCTED from the own `name` and compared
 * against what the value actually renders.
 *
 * The reconstruction is sound because the engine renders the TARGET's name, and
 * `bind` derives the value's own `name` from that same target name — the two
 * are the same string with one `'bound '` prefix between them. Measured on
 * WebKit 26.5 (probe A9): renaming a bound function AFTER binding does not move
 * the rendered name, so the slot is caller-chosen only before `bind` runs and
 * cannot be steered behind this predicate's back afterwards.
 *
 * That inverts mark 3's role. In the sibling it is merely the cheapest read; in
 * here it is a PRECONDITION, because the expected source cannot be assembled
 * without a `'bound '`-prefixed name to derive it from. Hence the early return
 * on the entrance-level and the single `name` read reused by both marks.
 *
 * The `[[Construct]]` mark stays conditional for the sibling's reason: a bound
 * arrow or concise method never had a slot, so what the clause contributes is
 * the `Proxy` subtraction, which only bites where a slot exists.
 *
 * ## What it recovers
 *
 * Every bound form whose target carries a name — which on such an engine is
 * every bound form except the anonymous ones, and which the sibling rejects
 * wholesale there.
 *
 * ## What it still rejects
 *
 * A bound function whose `name` was overwritten (mark 3 gone, and with it the
 * derivation), `Function.prototype` (empty `name`), an arrow or concise method
 * renamed to look bound (its own source text is no native form), and a bare
 * `Proxy` (it forwards the target's `name`). A `Proxy` that also TRAPS `name`
 * passes only if the trapped value matches what the engine renders for the
 * proxy itself, so the sibling's one surviving forgery generally fails here.
 *
 * ## What it newly admits — a decided boundary, not an open cost
 *
 * A native built-in renamed to `'bound '` plus its own rendered name. On such
 * an engine that value and a genuinely bound built-in are indistinguishable —
 * identical own `name`, identical rendered source, and neither holds a construct
 * slot — so no reading can separate them, and admitting the genuine one admits
 * the forgery with it. The exposure is confined to natives: a user function
 * renamed the same way still carries its own source text and fails mark 2.
 *
 * It is kept deliberately. Closing it means requiring a construct slot here,
 * which refuses every bound arrow, concise method, generator and
 * non-constructable native on this engine — four ordinary shapes surrendered to
 * block one forgery a caller has to build on purpose. A `doesIndicate` predicate
 * reports evidence, and evidence the caller forged is still evidence honestly
 * reported (#088). The `concise` module answers the same question the other way
 * because its law forbids a false positive outright; the difference between the
 * two modules' names is the difference between their answers. Recorded as
 * `dSIBF/B2` in `BOUND.spec.md`, beside the `Proxy` boundary it sits next to.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which carries no bound markers
 * @returns {boolean} `true` when every bound mark (in addition to the
 *  qualifying entrance-level) is present; `false` otherwise
 *
 * @internal
 */
export function doesStronglyIndicateJSCSpecificBoundFunction(value) {
  // - (negated) minimum entrance-guards
  if (!isFunction(value) || hasOwnPrototype(value)) {
    return false;
  }
  const fctName = getVerifiedOwnName(value) ?? '';

  return (
    // - spoofable indicator
    fctName.startsWith(BOUND_NAME_PREFIX) &&
    // - For JavaScriptCore engines, the strongest evidence must be partially
    //   re-constructed. E.g., Safari does not make a distinction in between
    //   the bound and un-bound function sources of ANY built-in function.
    //   Therefore, we need to assemble the expected function-source-string
    //   of a function's bound variant.
    getCondensedFunctionSource(value) ===
      createExpectedJSCSpecificFunctionSourceFromBoundName(fctName) &&
    // - reliable detection, but does apply just to constructable types
    (hasConstructSlot(value) ? !doesMatchProxyConstructor(value) : true)
  );
}

/* @@throw-safe */
/**
 * The conjunction as an engine that renders a bound function ANONYMOUSLY reads
 * it — {@link doesStronglyIndicateBoundFunction}'s implementation wherever
 * {@link hasJavaScriptCoreBindBehavior} does not hold, and the module's
 * original single implementation.
 *
 * The same entrance-level and the same three marks as
 * {@link doesIndicateBoundFunction}, conjoined instead of cascaded. Requiring
 * all of them closes two boundaries the cascade documents as accepted.
 * `Function.prototype` is genuinely anonymous and native, but carries no
 * `'bound '` name. And any prototype-less callable merely renamed to look bound
 * still has its own source text — a guarantee that holds here for natives too,
 * because on these engines a native's rendered name distinguishes it from a
 * bound value, which is exactly what the JavaScriptCore sibling cannot rely on.
 *
 * The `[[Construct]]` mark is applied conditionally rather than required. A
 * bound arrow or bound concise method has no construct slot, so demanding one
 * would reject half the bound forms. What the clause contributes here is the
 * `Proxy` subtraction, which only bites where a slot exists.
 *
 * Ordered cheapest-first — the opposite of the cascade, and for the mirrored
 * reason. A conjunction ends at the first mark that FAILS. So the two
 * descriptor reads run before the string allocation, and the
 * `Proxy`-allocating construct probe runs last. Mark 3 leads by cost here, not
 * by necessity; the sibling needs it first for a structural reason.
 *
 * Recall is the price. A genuine bound function whose `name` was overwritten is
 * reported `false`; the cascade still catches it. This variant degrades to
 * silence where the cascade degrades to a weaker answer.
 *
 * Selected only where mark 2 can fire, so its former blanket cost on a
 * name-rendering engine no longer applies — there the sibling runs instead.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which carries no bound markers
 * @returns {boolean} `true` when every bound mark (in addition to the
 *  qualifying entrance-level) is present; `false` otherwise
 *
 * @internal
 */
export function doesStronglyIndicateNonJSCBoundFunction(value) {
  return (
    // - minimum entrance-guards
    isFunction(value) &&
    !hasOwnPrototype(value) &&
    // - spoofable indicator
    (getVerifiedOwnName(value) ?? '').startsWith(BOUND_NAME_PREFIX) &&
    // - strong evidence (the anonymous form, which only an engine that renders
    //   bound functions anonymously can produce. On a name-rendering engine
    //   this equality never holds, which is why that engine gets the sibling
    //   implementation rather than a weaker gate to fall through to.)
    getCondensedFunctionSource(value) === CONDENSED_NATIVE_SOURCE_FOUNDATION &&
    // - reliable detection, but does apply just to constructable types
    (hasConstructSlot(value) ? !doesMatchProxyConstructor(value) : true)
  );
}

/* @@throw-safe */
/**
 * Reports whether the value carries EVERY bound mark, where
 * {@link doesIndicateBoundFunction} asks for any one of them.
 *
 * Dispatches to whichever implementation can read mark 2 in this realm:
 * {@link doesStronglyIndicateJSCSpecificBoundFunction} where
 * {@link hasJavaScriptCoreBindBehavior} holds,
 * {@link doesStronglyIndicateNonJSCBoundFunction} otherwise.
 *
 * Per call rather than resolved once into a binding, for three reasons that all
 * came out of measurement. The dispatch is not measurably cheaper when hoisted,
 * because the probe read is memoized and both it and the branch inline. An
 * alias would report its implementation's `name` rather than its own, from a
 * package whose subject is reading function names. And resolving at module-eval
 * time would run the probe during import for every consumer, including those
 * that never call this predicate.
 *
 * Both share the entrance-level, mark 3 and the conditional `[[Construct]]`
 * mark, and both trade recall for precision against the cascade. They differ in
 * mark 2 alone, and therefore in what they admit: the details that follow from
 * that live on each implementation, because they are not the same set.
 *
 * The answer may differ between engines, and that is the intent. A realm that
 * reveals more is answered more precisely rather than being cut down to what
 * the least revealing realm can see. A consumer needing one answer everywhere
 * should read {@link doesIndicateBoundFunction}, whose marks 1 and 3 are
 * specified rather than engine-defined.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which carries no bound markers
 * @returns {boolean} `true` when every bound mark (in addition to the
 *  qualifying entrance-level) is present; `false` otherwise
 */
export function doesStronglyIndicateBoundFunction(value) {
  return hasJavaScriptCoreBindBehavior()
    ? doesStronglyIndicateJSCSpecificBoundFunction(value)
    : doesStronglyIndicateNonJSCBoundFunction(value);
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

# Open questions

These are not decisions but acknowledged open questions, kept here so they don't dissolve
into folklore.

## Q.001 — `getDefinedConstructorName` direct-access vs. descriptor read (RESOLVED 2026-06-03 by decision #020)

Resolved by adopting the spec-shape access-path rule. `getDefinedConstructorName` now
reads `name` via the property descriptor without a direct-access fallback (`name` is own
data per ECMA-262 §10.2.9, so the descriptor read is canonical). `getDefinedConstructor`'s
meta-constructor steps stay on direct access (inherited per spec; the engine's
prototype-chain walk is the spec-correct resolution). See decision #020 for the framing
and the broader rule.

## Q.002 — Public-predicate bound-admission policy now that bound detection is cheap

The fingerprint matrix from decision #009 shows that bound detection is closed-form via
`own_proto: false` plus `name.value.startsWith('bound ')`. The strict/lenient asymmetry
that motivated decision #005's bound-admission rule is no longer load-bearing — every
species now has cheap bound and unbound discrimination from the same primitives. What
remains is the _policy_ question: which public predicates should be strict-bound (reject
bound) versus lenient-bound (admit bound) now that both flavors cost roughly the same? The
current shipped behavior is preserved (newable strict, non-newable lenient). Revisiting is
the user's call.

## Q.003 — `@species-js/function-introspection` scope

Per decisions #005, #013, and #016, `function-introspection` is the host for
source-parsing predicates that genuinely require `Function.prototype.toString.call`. Two
predicates currently belong there: the arrow-vs-concise distinguisher (the one true
collision the fingerprint schema cannot resolve), and `isBoundFunction` (the
spec-unreliable bound tell). The package has not yet been scaffolded. Whether it lives as
a standalone package or as a subpath of type-detection is open.

## Q.004 — `AbortableThenable<T>` deferred to the `@/error` migration (RESOLVED 2026-06-06 by decision #037)

The equip-js source defined `AbortableThenable<T> extends Thenable<T>` with an `onaborted`
callback typed against `AbortError`. The species-js `Thenable<T>` doc references this as a
strict refinement reserved for a separate type, but `AbortError` lives in `@/error`, which
is the next equip-js migration. Once `@/error` lands and `AbortError` is available,
`AbortableThenable<T>` can extend naturally from the existing `Thenable<T>` — the
type-system shape and the abort-channel predicate are both deferrable as one round when
the dependency is in place. Whether `AbortableThenable` ships in `thenable.d.ts`
(extending the lattice with a fourth tier) or as a separate `abortable-thenable.{js,d.ts}`
module is open; the question opens once the dependency is in scope.

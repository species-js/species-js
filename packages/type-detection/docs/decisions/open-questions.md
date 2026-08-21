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

## Q.002 — Public-predicate bound-admission policy (RESOLVED 2026-07-28 by decision #081)

The fingerprint matrix from decision #009 shows that bound detection is closed-form via
`own_proto: false` plus `name.value.startsWith('bound ')`. The strict/lenient asymmetry
that motivated decision #005's bound-admission rule is no longer load-bearing — every
species has cheap bound and unbound discrimination from the same primitives. What remained
was the _policy_ question: which public predicates should be strict-bound (reject bound)
versus lenient-bound (admit bound) now that both flavors cost roughly the same?

Resolved by decision #081 in favor of the shipped asymmetry (newable strict, non-newable
lenient). The cheap bound tell (`name.startsWith('bound ')`) is **spoofable** — `name` is
a writable own property, forgeable on any non-bound function — hence unreliable, and
unreliable classification signals do not belong in a reliability-first type-detection
library. They belong to the more forgiving `function-introspection` toolkit
(`isBoundFunction`, Q.003). So no predicate reads the tell, and the asymmetry is the free
residue of each predicate's spec-invariant discriminator. See ADR #081 and
`FUNCTION.spec.md` Resolved items #6.

## Q.003 — `@species-js/function-introspection` scope (RESOLVED 2026-08-06 by decision #087)

Resolved, and both halves of the question turned out to rest on stale premises. The
package **is** scaffolded and live in every workspace gate, so the
standalone-versus-subpath half was answered structurally long before it was recorded. The
two named tenants are a **floor, not a scope** — they record what type-detection expelled,
not what the package is for.

#087 supplies the scope from inside the package: structural role decides placement
(composed-from stays in detection, terminal comes here) with trust grade as a veto rather
than a promotion, which supersedes the principle stated in #013's Consequences. This
question is also the worked example of why `function-introspection` now keeps its own
decision log — it was a question about that package filed here, and it went stale where
nobody working on the package would look. The original text follows.

## Q.003 — `@species-js/function-introspection` scope (original)

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

## Q.005 — Host-backed hardening tier for `isPromise` (RESOLVED 2026-08-21 by decision #095)

**Declined.** The tier would work — `util.types.isPromise` rejects the graft, admits a
real promise, and touches no user getter — but it is a Node API with no standards track,
so the divergence it installs is permanent rather than transitional. That is the
difference from #082's native `Error.isError`, which is ECMA-262 and converges.
Portability is this package's contract, and #052's shape-not-liveness principle is a
boundary rather than a hole. Measured while deciding: the graft admission is symmetric
local and cross-realm, and the one portable substitute (`Promise.resolve(x) === x`) is
disqualified — it runs user code, allocates, and raised an uncaught exception on a hostile
fixture. The opt-in downstream adapter remains the home; re-open if a slot-reading promise
predicate reaches the language standards track. Original text follows.

## Q.005 — Host-backed hardening tier for `isPromise` (original)

Decision #052 establishes that `isPromise` cannot portably seal the
`Object.create(Promise.prototype)` graft: `Promise` exposes no inert internal-slot
accessor, so there is no side-effect-free `[[PromiseState]]` probe to mirror the boxed
primitives' `valueOf` slot-seal. The portable foundation accepts-and-documents the graft.

Some host environments do expose a spoof-proof slot check — Node's
`util.types.isPromise(value)` is a C++ binding that reads `[[PromiseState]]` directly with
zero side effects. An optional hardening tier could use such a primitive where present and
fall back to the structural predicate elsewhere. The open question is whether to offer it
at all, and where: it makes behavior **environment-divergent** (the graft would be
rejected under Node, admitted in browsers / bare engines), which argues against placing it
in the portable ES2020-floor foundation. If adopted, the natural home is an opt-in
downstream adapter that layers the host check over `@species-js/type-detection`,
documented as deliberately divergent. Not scheduled; revisiting is the user's call.

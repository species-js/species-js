# 005 — Bound-admission asymmetry by spec mechanics, not by design choice

**Date:** 2026-06-01

**Context.** The newable side has strict-vs-lenient predicate pairs that reject bound
variants (decision #003). The non-newable side does not — every non-newable predicate
admits bound variants. Was the asymmetry deliberate?

**Decision.** It is forced by spec mechanics, not chosen. The newable side's
discriminators are _own-instance descriptors_ (the `writable` flag on `prototype`, the
back-reference soundness). `bind` strips own slots, so bound variants fail strict checks
for free. The non-newable side's discriminators are _prototype-chain values_
(`Symbol.toStringTag` on `%X.prototype%`, the resolved constructor name walked via the
prototype chain). `BoundFunctionCreate` (ECMA-262 §10.4.1.3) sets the bound function's
`[[Prototype]]` to the target's `[[Prototype]]`, so tag and constructor-name resolution
survive `bind`. A bound async function inherits `%AsyncFunction.prototype%` and passes
every check the unbound version passes.

**Rationale.** Naming this honestly in docs avoids the false impression that the package
chose to admit bound async/generator functions. It admits them because there is no
structural way at the type-detection layer to tell a bound async function from a non-bound
one without source inspection — and source inspection is the introspection package's
concern.

**Consequences.** The honest doc voice names "lenient by spec mechanics" for non-newable
predicates. Source-regex predicates (`isBoundFunction`) go to `function-introspection`,
not type-detection. See decision #013 for the refined source-string ruling.

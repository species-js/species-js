# 013 — Spec-defined source-string checks stay in type-detection; heuristic ones go to introspection

**Date:** 2026-06-02

**Context.** An earlier framing held that any `Function.prototype.toString.call` source
parsing belonged in `function-introspection`, since most syntactic recognition through
stringification is heuristic. But `isCustomClass` and `isBuiltInClass` rely on
`getFunctionSource(value).startsWith('class')` to distinguish authored-via-`class` from
built-in constructors. Were those predicates misplaced?

**Decision.** Refine the ruling. ECMA-262 §27.3 specifies that class-syntax constructors
stringify with `class` as the leading keyword — a spec-guaranteed invariant.
`isCustomClass` and `isBuiltInClass` stay in type-detection. Heuristic syntactic
recognition (arrow vs. concise method, async source forms, the bound-source-form) goes to
`function-introspection`.

**Rationale.** There is no descriptor-only escape for the custom-vs-built-in distinction.
Both report `[object Function]`, both have `writable: false` on own `prototype`, both look
structurally identical. The source-string prefix is the _only_ spec-defined discriminator.
Forcing this distinction out of type-detection would fragment the package surface for a
question that has a reliable spec answer right here.

**Consequences.** The principle that drives placement decisions for any future predicate:
ask whether ECMA-262 _guarantees_ the stringification form. If yes, the predicate is
foundation-tier; if no, it is introspection-tier. `isBoundFunction` stays in introspection
per the prior ruling — `name`-prefix `'bound '` and the bound-source-form are both
heuristic-quality.

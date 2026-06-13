# 002 — Tier-S documentation style established and codified package-wide

**Date:** 2026-05-29 (established) → 2026-05-30 (package-wide alignment pass)

**Context.** Documentation across `Callable`, `isCallable`, and the primitive predicates
was diverging in opener form, tag form, and `@example` density. The sibling project
`equip-js` carried a similar style under stress and was hitting friction with stricter
`eslint-plugin-jsdoc` rules in this project.

**Decision.** Adopt a unified "Tier S" style across `type-detection`: definition-first
openers that name what the symbol _is_ or _does_; one-line `@param name - desc` and
`@returns desc` form; `@internal` always last and on its own line; member-role docs that
name the role rather than restating the type; `@example` earned (added only when narrowing
flow, edge cases, or typical returns are non-obvious); `## Subsection` markdown allowed
inside long doc blocks for enumerated lists. See CLAUDE.md "Code conventions" for the
binding form.

**Rationale.** A unified voice is cheaper to maintain and reads more uniformly under
TypeDoc. The style improves on the equip-js baseline (which the project draws from per the
sibling-baseline rule) rather than capping at it. `@example` discipline matters because
every export with a reflex `@example` produces TypeDoc noise that drowns out the ones that
genuinely help.

**Consequences.** Every doc block in the package was touched in the 2026-05-30 alignment
pass. The style binding is in CLAUDE.md (doc-voice bullet) so it survives memory rotation.
See decision #018 for the prose-voice refinement that landed 2026-06-03.

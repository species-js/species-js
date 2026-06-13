# 015 — All sub-helpers exported with parallel `.d.ts` declarations

**Date:** 2026-06-03

**Context.** The sub-helpers from decision #014 were initially module-local. Test-side
access required reaching into the implementation file directly.

**Decision.** Export all five sub-helpers, mark them `@internal`, and add matching
declarations to `function.d.ts`. The `@internal` tag keeps them out of published TypeDoc
output but makes them importable for tests.

**Rationale.** Sub-helpers exist for isolated testability. A module-local helper that
nothing can import is testable only through its orchestrator, which couples
shape-correctness tests to orchestration correctness. Exporting makes the unit boundary
match the test boundary. The `@internal` marker keeps the published surface honest.

**Consequences.** Future test code can import each sub-helper from `@/function` and
exercise each marker group independently. The package's external API surface (everything
not `@internal`) is unchanged.

# 004 — `AsyncFunction` is kin to `%AsyncFunction%`, not `%AsyncGeneratorFunction%`

**Date:** 2026-06-01

**Context.** The shared "Async" prefix in `AsyncFunction` and `AsyncGeneratorFunction`
invites confusion. ECMA-262 names three distinct non-newable intrinsics:
`%AsyncFunction%`, `%GeneratorFunction%`, `%AsyncGeneratorFunction%`.

**Decision.** Codify the family map. `AsyncFunction` belongs to the async family
(intrinsic `%AsyncFunction%`, no own `prototype`, returns `Promise`). `GeneratorFunction`
and `AsyncGeneratorFunction` belong to the generator family (intrinsics
`%GeneratorFunction%` and `%AsyncGeneratorFunction%`, own writable `prototype`, return
`Generator` or `AsyncGenerator`). The "Async" in `AsyncGeneratorFunction` describes what
the iterator _yields_, not the function itself.

**Rationale.** The shared prefix is misleading inherited spec naming. Structurally
`AsyncGeneratorFunction` is far closer to `GeneratorFunction` than to `AsyncFunction`.
Conflating the two in docs would propagate confusion to every consumer.

**Consequences.** Doc voice never co-locates `AsyncFunction` with `AsyncGeneratorFunction`
as near-cousins; the family-map framing is repeated in their respective interface docs and
the orchestrator docs.

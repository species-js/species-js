# 009 — Empirical fingerprint matrix as the discrimination signal

**Date:** 2026-06-02

**Context.** The non-newable shape predicates were reading six markers
(`!hasOwnPrototype`, `!hasConstructSlot`, tag, constructor-name, and two joined-string
signatures for the value's and proto's own keys). Was this redundant? Was it under-strict?
The question needed empirical answers, not just spec-level reasoning.

**Decision.** Run a structured cheat-sheet across every ES function source-form
(statement, expression, arrow, concise method, class) for every species (ES3, class,
async, generator, async-generator) in both unbound and bound variants, and tabulate the
discrimination columns. The result is a closed-form matrix over the tuple
`(newable, own_writable_prototype, [[Class]] tag, prototype-own-key-signature)` that
distinguishes every species except two genuine collision classes: arrow-vs-concise
(descriptor-identical; only `[[HomeObject]]` differs) and bound-vs-unbound within the
arrow/concise rows.

**Rationale.** Empirical validation closes the question that pure spec-reading cannot. The
matrix is a _design artifact_, not a production primitive — it proves that every species
is structurally separable. The implementation primitive that embodies the matrix is a
separate question, settled by decisions #011 and #013.

**Consequences.** The collision classes are named precisely. Arrow-vs-concise belongs in
`function-introspection` (it genuinely requires source parsing). Bound-vs-unbound within
arrow/concise rows resolves with a single descriptor _value_ read on `name`
(`.startsWith('bound ')`) — descriptor-land, not source-land. The matrix lives in the
project memory as a frozen artifact for future reference.

# function-introspection — Decision log

A chronological record of architectural and design decisions in
`@species-js/function-introspection`, captured as ADRs (Architecture Decision Records).
Each file is self-contained: Context, Decision, Rationale, Consequences. Later decisions
that supersede earlier ones add new files with explicit pointers back, rather than
mutating the historical record.

ADR filenames follow `NNNN-short-kebab-slug.md`. Decision numbers within prose are
referenced as `#NNN` (without zero-padding) for readability.

**ADRs carry no commit pointer, by design.** A `Commit:` field once sat on 22 of them and
was never resolved on a single one; `git log --diff-filter=A -- <file>` answers the
question exactly, so the field only ever restated the commit that already contained it.
Reintroducing it would need a gate to stay true — and an unenforced field that has never
held is worse than none, because it reads as information.

**Numbering continues the workspace-wide sequence** and does not restart at 001.
`decisions:check` builds one supersession graph across every `packages/*/docs/decisions`
directory, keyed by decision number — so a restarted count would silently overwrite
another package's entries, and every reciprocity check touching those numbers would be
computed against the wrong document while the gate still passed. Cross-package edges are
the reason the graph is merged, and unique numbering is the price.

Decisions that shaped this package before it had a corpus of its own live in
[type-detection's log](../../../type-detection/docs/decisions/README.md) — #005, #013,
#016 and #081 all drew this boundary from the outside. #087 is the first written from
inside it.

## Decisions

| #                                                       | Title                                                                                                                                                    | Date       |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| [087](./0087-placement-is-role-not-reliability.md)      | Placement is role, not reliability — terminal vs composed-from decides the package; supersedes #013's stated principle                                   | 2026-08-06 |
| [088](./0088-trust-travels-in-the-name.md)              | Trust travels in the name — `doesIndicate` prefix, plain `boolean`, no marker and no tier folder; qualified variants                                     | 2026-08-06 |
| [089](./0089-tests-resolve-workspace-deps-to-source.md) | Tests resolve workspace dependencies to source, through the public entry — and so enforce #085's surface across packages                                 | 2026-08-07 |
| [090](./0090-proven-admission-earns-the-is-prefix.md)   | Proven admission earns the `is` prefix — the four criteria a reliable-grade predicate here must meet; complements #088                                   | 2026-08-11 |
| [091](./0091-entry-parity-is-gated-statically.md)       | Entry parity is gated statically — `exports` ↔ legacy fields ↔ vite entries, by parity rather than file existence; guards #085's schema and #089's alias | 2026-08-12 |
| [092](./0092-built-bundles-are-smoke-tested.md)         | Built bundles are smoke-tested — every published artifact loaded and executed; presence and shape are not sufficient; scaffolds go private               | 2026-08-12 |
| [093](./0093-release-policy.md)                         | Release policy — caret dependency ranges, first version 0.1.0, independent versioning, changesets-automated flow, and no missing-changeset gate          | 2026-08-12 |

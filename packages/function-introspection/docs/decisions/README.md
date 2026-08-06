# function-introspection — Decision log

A chronological record of architectural and design decisions in
`@species-js/function-introspection`, captured as ADRs (Architecture Decision Records).
Each file is self-contained: Context, Decision, Rationale, Consequences. Later decisions
that supersede earlier ones add new files with explicit pointers back, rather than
mutating the historical record.

ADR filenames follow `NNNN-short-kebab-slug.md`. Decision numbers within prose are
referenced as `#NNN` (without zero-padding) for readability.

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

| #                                                  | Title                                                                                                                  | Date       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------- |
| [087](./0087-placement-is-role-not-reliability.md) | Placement is role, not reliability — terminal vs composed-from decides the package; supersedes #013's stated principle | 2026-08-06 |
| [088](./0088-trust-travels-in-the-name.md)         | Trust travels in the name — `doesIndicate` prefix, plain `boolean`, no marker and no tier folder; qualified variants   | 2026-08-06 |

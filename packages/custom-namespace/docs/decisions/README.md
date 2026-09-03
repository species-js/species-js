# custom-namespace — Decision log

A chronological record of architectural and design decisions in
`@species-js/custom-namespace`, captured as ADRs (Architecture Decision Records). Each
file is self-contained: Context, Decision, Rationale, Consequences. Later decisions that
supersede earlier ones add new files with explicit pointers back, rather than mutating the
historical record.

ADR filenames follow `NNNN-short-kebab-slug.md`. Decision numbers within prose are
referenced as `#NNN` (without zero-padding) for readability.

**Numbering continues the workspace-wide sequence** and does not restart at 001.
`decisions:check` builds one supersession graph across every `packages/*/docs/decisions`
directory, keyed by decision number — so a restarted count would silently overwrite
another package's entries while the gate still passed.

**A record is amended in place only where its factual CONTEXT has moved, never where its
content has.** A dated banner marks the amendment and states that the decision itself is
untouched; #086 and #092 both carry one. A referent — an identifier pointing at something
that still exists under a different name — is simply maintained, since one that no longer
resolves breaks `grep` across the whole log. What is never rewritten: what was decided,
the rationale, measured numbers, quoted output, and superseded claims.

Decisions that shaped this package before it had a corpus of its own live in
[type-detection's log](../../../type-detection/docs/decisions/README.md) — #085 drew the
curated-surface rule, and #086 the realm-fixed-capture rule that this package's `#config`
applies. #096 is the first written from inside it.

## Decisions

| #                                                         | Title                                                                                                                       | Date       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------- |
| [096](./0096-the-artifact-is-a-namespace-not-a-domain.md) | The artifact is a namespace; `domain` names the role, not the thing — package renamed from `custom-domain`, vocabulary kept | 2026-09-03 |
| [097](./0097-the-published-root-is-the-module-itself.md)  | The published root is `src/index.js`; the barrel/`public` split earns itself per MODULE, not per export                     | 2026-09-04 |

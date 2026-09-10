# 102 — ADRs declare what enforces them

**Date:** 2026-09-10

**Enforced by:** `decisions:check` (R4)

**Context.** #076 clause 2 was wrong for seven weeks. Nothing watched it, and nothing
recorded that nothing watched it. A `Commit:` field was tried once and removed — the
decision-log README's verdict is that unenforced metadata reads as information — so this
field ships with its gate.

**Decision.**

1. **From #102 on, every ADR carries an `Enforced by:` line under `Date:`.** Two forms:
   one or more backticked workspace scripts, or the literal `nobody — <reason>`.
2. **`nobody` is a first-class answer.** Voice, naming and scope decisions have no
   artifact to drift, and several ADRs decline to build anything. The field makes "nothing
   holds this" visible; it does not demand a gate.
3. **R4 checks reciprocity, not presence.** A named script's source must cite the ADR's
   own number. `decisions:check` exits 1 otherwise, alongside R1.
4. **No retrofit.** #085, #091, #092 and #101 are back-annotated, being the four a gate
   demonstrably holds. #001–#100 stay as they are.

**Rationale.** Presence is unverifiable — any plausible script name passes, which is how
`Commit:` failed. Reciprocity is the pattern that has held here: R1 has sat at zero since
#054 gated it. The cost is one ADR number in a gate's error message, which a useful
finding carries anyway.

**Consequences.**

- R4 proves a gate **knows about** a decision, not that it **covers** it. A gate may cite
  #NNN and check one corner. The field is a pointer, not a completeness proof.
- `nobody` entries are unenforced by construction.
- The convention has one home, `CLAUDE.md`. The three decision-log READMEs carry nothing.

**Trip condition.** Delete R4 and the field if R4 has not caught a missing or false claim
within the next dozen ADRs. A check that never goes red for a real defect is a fixture.

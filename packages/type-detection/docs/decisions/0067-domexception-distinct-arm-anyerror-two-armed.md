# 067 — `DOMException` as a distinct arm, not an `Error` subtype; `AnyError` two-armed; `DOMExceptionLike` cut

**Date:** 2026-07-10

**Context.** The three-predicate split (#065) needs a type model for the `Error` /
`DOMException` distinction, and the distinction is genuinely contested at runtime: engines
disagree on whether `new DOMException() instanceof Error` holds — some make `DOMException`
an `Error` subclass, others do not. The retired design carried a single
`GenericError = DOMException | Error` type and one `isError`. The redesign question
(user-led): how should the type surface model `DOMException` so that the runtime partition
stays deterministic across that engine disagreement, and does `DOMException` warrant a
`Like` tier the way `Thenable` / `EventTarget` do?

**Decision.** Model `DOMException` as a distinct, package-owned arm — never an `Error`
subtype — and hold the union genuinely two-armed:

1. `DOMException` is a **package-owned interface, deliberately NOT `extends Error`**. It
   `extends DOMExceptionLegacyCodes` only, declares own `name` / `message` / `code`, and
   declares **no `stack`** (WebIDL defines none; a `stack` appears only where an engine
   happens to subclass `Error`).
2. `AnyError = Error | DOMException`, **load-bearing two-armed** — it must not collapse to
   `Error`. This is the narrow target of `isError` and `isAnyError`.
3. Predicate annotations: `isGenericError → value is T & Error`;
   `isDOMException → value is T & DOMException`; `isError` /
   `isAnyError → value is T & AnyError`.
4. The "generic ≠ `DOMException`" exclusion is a **runtime guarantee documented in prose,
   not a type**. TypeScript has no negation type, so `value is T & Error` cannot spell
   "and not a `DOMException`"; the invalid `& !DOMException` JSDoc phrasing was cut from
   both files. Because `DOMException` is not modeled as an `Error` subtype, `T & Error`
   already excludes `DOMException` structurally in ordinary use, and the runtime check
   (#069) remains the authoritative one.
5. **`DOMExceptionLike` is cut** — an orphan. Unlike thenable / evented, there is no
   `isDOMExceptionLike` predicate, so the type had no consumer. The `.d.ts` type set is
   exactly six: `AnyError`, `DOMException`, `DOMExceptionLegacyCodes`,
   `ErrorConstructorES2025` (`@internal`), `AbortErrorName`, `AbortError`.
6. `DOMException` is package-owned rather than an alias of `lib.dom.d.ts`'s global so the
   discouraged legacy surface is flagged uniformly — `lib.dom.d.ts` deprecates only `code`
   and leaves the 25 `DOMExceptionLegacyCodes` constants un-annotated; the package type
   marks `code` AND every constant `@deprecated`. Runtime-faithful, not a stripped view: a
   real `DOMException` carries these members, so they are discouraged, not removed.

**Rationale.** Pinning `DOMException` as its own always-excluded arm is what makes
`isGenericError`'s membership **deterministic across engines** — if the type (and the
runtime partition) treated `DOMException` as an `Error` subtype, a `DOMException` would
inhabit `T & Error` and the partition boundary would move with the engine's subclass
decision. Keeping the union two-armed also keeps `DOMException`'s distinct, deliberately
deprecated legacy `code` surface documented at the type level rather than dissolved into
`Error`. Declaring no `stack` is the type-level statement of the same
environment-dependence the runtime handles: a stack is not guaranteed, so a consumer that
needs one narrows through `Error` or `AnyError`. Branding stays rejected (#001) — the
distinction is carried structurally, not by a phantom tag.

**Consequences.** Enables the disjoint partition of #065; the runtime exclusion mechanism
is #069. Renames the retired `GenericError` _type_ (`DOMException | Error`) to `AnyError`;
the name `GenericError` is freed (a possible future `type GenericError = Error` alias —
for family symmetry `AnyError = GenericError | DOMException` — is left open, a nominal
documentation call that changes no vector). No ADR is superseded — this is new type
modeling; #032's `GenericError = DOMException | Error` type belongs to the structure #065
retires.

Builds on #001 (branding rejected), #035
(`AbortError = AnyError & { name: AbortErrorName }`), #065 (the three-predicate split this
typing serves).

Commit: _pending_.

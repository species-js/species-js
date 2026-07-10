# 068 — `isDOMException` descriptor-kind contract: getter admits, data rejects; #063 own-shadow deliberately not applied

**Date:** 2026-07-10

**Context.** `isDOMException` is the sole generic `DOMException` predicate (no `Like`
tier, no `Strict` variant — #067), so it must admit **every** `DOMException`, including
third-party subclasses whose design the package does not control, without becoming so
loose that any error-shaped object slips through. WebIDL backs a `DOMException`'s `name` /
`message` with prototype accessors over an internal slot — a genuine instance **owns none
of its contract**, inheriting the getters. That "owns none of its contract" shape is
exactly what #063's own-level contract-shadow rejection targets for the strict identity
predicates (`isEventTarget` / `isAbortSignal` / `isPromise`), and #063 left a forward
FAMILY question: does a spec-pinned type like `DOMException` warrant a
`doesNotShadowDOMExceptionContract` gate? The design question (user-led): what is the "not
too hard, not too soft" contract for `name` / `message`, and does the #063 own-shadow
guard apply?

The framing (user-led): every subclassed `DOMException` should pass; a plain data-property
`name` (a `value` descriptor) should be rejected, but a `get`-gated `name` should be
admitted **wherever it lives** — from the instance's own slot down to the first-matching
prototype.

**Decision.** The `DOMException` contract is **descriptor-KIND based**, not key-presence
based. `doesImplementDOMExceptionContract(value)` =
`hasInertGetter(value, 'message') && hasInertGetter(value, 'name')`, where
`hasInertGetter` resolves the descriptor through the prototype chain **own-first,
first-match-wins** (via the chain-walking `getInertDescriptor`):

- `name` and `message` must each be an **accessor** (a callable `get`), reachable anywhere
  from the value's own slot up to the first-matching prototype. A plain **data** `value`
  descriptor is rejected wherever it sits (first-match-wins: an own data property
  shadowing an inherited getter rejects).
- The rule is **symmetric** on `name` and `message`.
- The contract reads **presence, never invocation** in the current realm (the getter is
  not called; `hasInertGetter` checks the descriptor shape). The cross-realm arm
  (`doesImplementDOMExceptionPrototypeContract`) DOES invoke, threading a live receiver,
  because the spec getters throw on a non-`DOMException` receiver.

**#063's own-shadow guard is deliberately NOT applied to `isDOMException`.**

**Rationale.** #063 rejects a contract member on own-KEY presence _regardless of
descriptor kind_ — it treats any own `name` as an instance-level override. That is the
wrong tool for a getter-backed contract: it would reject an own-getter `name`, which this
policy deliberately admits (a legitimate get-gated `name` living on the instance). The
getter-vs-data test is the finer, correct discriminator. It maps cleanly onto real
subclass idioms: a subclass that names itself through `super(message, name)` keeps the
inherited getter and is admitted; a subclass that flattens `name` to a data field via a
class field (`class X extends DOMException { name = 'X' }`) or `defineProperty` — the
`Error` idiom, redundant on `DOMException`, which already takes a name argument — is the
"dumb data name" and is rejected. `isGenericError`'s own-shadow question is separately
**N/A**: `Error` is a data-carrier that owns its contract by design (a genuine
`new Error('m')` owns `message` and `stack`), so "owns a contract member = tamper" is
false there, the same reason `isPlainObject` is exempt in #063.

**Consequences.** "Every `DOMException` instance is admitted" precisely means "every one
that keeps its getter-backed contract". A flattened-name `DOMException` subclass is
rejected by `isDOMException` — and, being still `instanceof DOMException`, is also
excluded from `isGenericError` (#069), so it lands as **neither** arm (a malformed
`DOMException`). The bare `Object.create(DOMException.prototype)` graft is admitted
(presence-only; provenance / liveness is not probed current-realm — the inherited getter
would throw if invoked, but the contract never invokes it), parallel to the evented
bare-graft admit. The legacy numeric `code` is deliberately not tested. This **answers
#063's forward FAMILY question for `DOMException`: not applicable — a getter-backed
contract discriminates by descriptor kind, not key presence**, so `isDOMException` carries
no `doesNotShadow*` gate.

Builds on #063 (own-shadow FAMILY question, here answered "not applicable"), #020 / #021 /
#029 (spec-shape / inert-descriptor access without invocation), #067 (`DOMException` as a
distinct arm, no `DOMExceptionLike`).

Commit: _pending_.

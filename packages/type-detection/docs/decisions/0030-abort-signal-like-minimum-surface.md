# 030 — `AbortSignalLike` minimum-surface choice — omit `reason`, `onabort`, and typed-event-map overloads

**Date:** 2026-06-04

**Context.** The lib's `AbortSignal` interface carries `readonly reason: any`,
`onabort: ((this: AbortSignal, ev: Event) => any) | null`, and the `AbortSignalEventMap`
overloads for `addEventListener` / `removeEventListener`. Each represents a real spec
member. The question was which to include in `AbortSignalLike`.

**Decision.** Include only the two members that are spec-required AND structurally
testable without invoking accessors the spec doesn't require: `readonly aborted: boolean`
and `throwIfAborted(): void`. Omit `reason`, `onabort`, and the typed-event-map overloads.

**Rationale.** Each omission has its own reason:

- **`reason: any`** — no structural constraint to verify. `any` accepts anything; the
  predicate has nothing to test beyond presence, and presence alone is uninformative (an
  absent `reason` is still spec-conformant — its presence depends on whether the signal
  has been aborted).
- **`onabort`** — sugar over the EventTarget contract that is already validated.
  Registering a single-property event listener is convenience over `addEventListener`; the
  underlying capability is the `addEventListener` already required by `EventTargetLike`.
- **Typed-event-map overloads** — TypeScript convenience for IDE autocomplete on
  `addEventListener('abort', …)`; not part of the runtime contract. Including them in the
  structural interface would not affect runtime detection but would couple the interface
  to the lib's `AbortSignalEventMap` evolution.

**Consequences.** `AbortSignalLike` is intentionally smaller than the lib's `AbortSignal`.
Any value satisfying our `AbortSignalLike` satisfies a subset of the lib's `AbortSignal`
contract — sufficient for the abort-channel scenarios this module supports. Consumers
needing the full lib interface should narrow further from `AbortSignalLike` to
`AbortSignal` via `isAbortSignal`. The line is drawn at "what's structurally testable
without invoking accessors the spec doesn't require." Applicable forward to any future
interface migrations (Iterator protocol, EventEmitter, etc.) — the same principle of
"include only the spec-required + structurally-testable surface" applies.

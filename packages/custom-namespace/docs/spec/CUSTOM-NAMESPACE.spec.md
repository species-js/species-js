# custom-namespace — behavioral specification

> Spec format and the multi-axis test model come from
> [type-detection's spec README](../../../type-detection/docs/spec/README.md). This
> package follows that model and does not restate it.
>
> Written from `src/index.d.ts`, `src/index.js`, `src/config/index.{js,d.ts}`, ADR #096
> (the artifact vocabulary) and ADR #086 (where captures live). This package has no
> `docs/architecture/` yet.
>
> **Status: FROZEN 2026-09-04** — owner-reviewed. This is the base for the axis-1
> (contract) suite. From here on, amend it in place with a dated banner (#054) rather than
> rewriting: a spec that contradicts the code is worse than an amended one.
>
> **Amended 2026-09-04** — `type/T5` went from unverified to asserted, and the vector
> count was corrected from 53 to 54. Both are recorded under Resolved items; the count was
> written before `ns/B3` was appended and never revised. No vector's meaning changed.

### How to read this

A **vector** is one testable claim with a stable ID, written as
`input → expected — rationale`. The ID is what a test cites, so spec and suite stay
traceable. IDs are **append-only**: never renumber one, add a higher number or mark it
withdrawn.

The class letter says what kind of claim it is. `A` — accepted. `R` — refused. `B` — a
boundary worth pinning, usually where the specified behavior is the surprising one. `T` —
a type-level claim, checked by `pnpm run typecheck` rather than at runtime.

Every vector here was checked by **running it** when it was written, not by reading the
code. The probe that ran them was itself mutation-tested first — deliberate breakages each
had to redden the vectors naming them — because a probe that cannot fail proves nothing.
The probes were then deleted, per the decidability-run convention.

Three claims did not survive that check. They were fixed in `7842905` rather than written
down here as though specified.

> **The axis-1 suite exists and is the standing form of these checks** —
> `test/spec.test.js` plus `test/type-contract.js`, asserting **all 54** vectors below.
> The suite was mutation-probed three ways, and `pnpm run typecheck` gates the `type/T*`
> band.

## Module contract

`@species-js/custom-namespace` builds **frozen, prototype-less namespace objects**: a
module's exports grouped behind one named, identifiable value. It exports one function,
`createCustomNamespace`, and one type, `CustomNamespace`.

The artifact is closest in spirit to an ECMAScript module namespace, and deliberately so.
It is non-extensible, its members are neither writable nor configurable, and its brand
does not survive into a copy of it.

### Why this spec is shaped differently

The shared README's template is organized per public predicate: its **Admits** and
**Rejects** vector lists, a **Refuses to claim** section, and its cross-realm and
spoof-resistance expectations.

Three of those presuppose a function that judges a value it did not make. This package has
no predicates. It has one builder, so:

- **Admits / Rejects** survive, but as accepted-or-refused _arguments_, not as
  `true`/`false` answers about a value.
- **Spoof-resistance** has no subject. Nothing here claims to detect anything, so there is
  nothing to forge past.
- **Cross-realm expectation** likewise — see _Refuses to claim_.
- **Refuses to claim** transfers unchanged, and is kept in full below.

`CONFIG.spec.md` is the in-repo precedent for a spec that declares its own dimensions
instead of forcing a non-predicate module into the predicate template. This spec has four,
each with its own vector prefix:

| Dimension                 | Question it answers                                        | Prefix           |
| ------------------------- | ---------------------------------------------------------- | ---------------- |
| **A — Argument contract** | Which `name` and `exports` values are accepted or refused? | `ccn/*`          |
| **B — Member resolution** | How does one own key of `exports` become one member?       | `mem/*`          |
| **C — The artifact**      | What is the thing that comes back?                         | `ns/*`, `prim/*` |
| **D — Failure semantics** | What happens when a build fails, and when?                 | `fail/*`         |

Dimension C is the bulk of the contract and has no analogue in a predicate spec at all: it
describes a value the module _creates_ rather than one it _judges_. Two smaller bands
follow — `type/T*` for the type-level contract, and `cap/*` for the realm-fixed captures.

### ⚠ The throw-contract is inverted here

The shared README calls throw-safety _the universal invariant_: a predicate returns
`false` on any throw, an `@internal` helper returns its sentinel, and no input however
hostile makes a detector throw.

**This module specifies the opposite, on purpose.** It reads `exports` through raw,
unguarded forms rather than type-detection's throw-safe `getSafe*` twins, and it invokes a
source getter unprotected. A source that cannot be enumerated, described or read fails the
build.

The reason is a difference in kind, not a lapse. A predicate answers a question about a
value it did not make; when it cannot even read that value, `false` is the honest answer.
A builder produces an artifact its caller will rely on. When it cannot read part of its
input, the honest outcome is **no artifact**, because a namespace quietly missing a member
is worse than one that never gets built.

This is affordable because `exports` is expected to be the author's own module surface at
definition time. That expectation is also what makes running its getters here acceptable.

**One consequence for the vocabulary.** In a type-detection spec, `R` is observable as
`false`. Here `R` is observable as a throw. The meaning is the same — this input is
refused — only the form differs.

### Rejection order

The order is part of the contract, not an implementation detail. The first blocker wins,
so one mistake always reports the same way, and a caller fixing one rejection is never
handed a different error for the same underlying problem.

Four whole-argument checks run first, in argument order, before anything is read:

1. `name` is not a string
2. `exports` is neither a plain object nor a prototype-less dictionary
3. `exports` has no own property
4. `exports` carries a reserved key

Per-member failures come after all four, during resolution, in **own-key order**. Own-key
order is not source-literal order; `fail/B2` pins the difference.

## Surface inventory

Mechanical completeness before any vectors, per the audit discipline.

| Export                     | Module    | Visibility  | Kind     | Notes                                |
| -------------------------- | --------- | ----------- | -------- | ------------------------------------ |
| `createCustomNamespace`    | `#index`  | public      | function | the only public value in the package |
| `CustomNamespace`          | `#index`  | public      | type     | the artifact's declared shape        |
| `globalContext`            | `#config` | `@internal` | capture  | realm-fixed, ADR #086                |
| `objectAssign`             | `#config` | `@internal` | capture  | realm-fixed                          |
| `objectFreeze`             | `#config` | `@internal` | capture  | realm-fixed                          |
| `defineProperty`           | `#config` | `@internal` | capture  | realm-fixed                          |
| `getOwnPropertyDescriptor` | `#config` | `@internal` | capture  | realm-fixed, raw (not throw-safe)    |

Four more values are module-local and deliberately not exported: the functions
`toPrimitive`, `resolveNamespaceMember` and `aggregateNamespaceTarget`, plus the
`reservedNamespaceKeys` set.

**That has a direct consequence for the test model: this package has no helper-unit suite
(axis 4).** Every branch those four carry must be reachable through
`createCustomNamespace`, or it is unreachable and should not exist. The trade is
deliberate, since a direct helper test would pin inputs the public entry normalizes away.
It does mean the contract suite carries coverage that type-detection spreads over two
suites.

`#config` is not a published subpath; the bundler inlines it into the entry. The package's
`exports` map has a single `"."` entry.

## A — Argument contract (`ccn/*`)

### `name: string`

- `ccn/A1` — `'demo'` → accepted; the namespace renders `"[namespace 'demo']"`.
- `ccn/A2` — `new String('boxed')` → accepted. `isString` admits a boxed `String`, which
  `String(name)` then unboxes.
- `ccn/R1` — `42`, `null`, `undefined`, `Symbol()`, `{}` → **throws** `TypeError`,
  `'name' must be a string.`
- `ccn/B1` — `'   '` → **accepted**, trimmed to `''`, rendering `"[namespace '']"`.
- `ccn/B2` — `"a'b"` → `"[namespace 'a'b']"`; `'a\nb'` → `"[namespace 'a\nb']"`.
- `ccn/B3` — `'  a b  '` → `"[namespace 'a b']"`. Trimmed at the edges only; interior
  whitespace survives.

A bad **type** is refused; a degenerate **value** is not. `'   '` reads as a caller
deliberately choosing an anonymous namespace, while `42` is a mistake the builder used to
swallow into that same empty name. The two are judged differently on purpose.

The name is not escaped, quoted or otherwise restricted (`ccn/B2`). The representation is
for a human reading a log, not a parseable form — a detector must not try to parse the
name back out of it.

### `exports: T extends object`

- `ccn/A3` — an object literal `{ a: 1 }` → accepted.
- `ccn/A4` — `Object.assign(Object.create(null), { a: 1 })` → accepted.
- `ccn/A5` — `new Proxy({ a: 1 }, {})` → accepted. A benign `Proxy` over either admitted
  shape qualifies.
- `ccn/R2` — `[]`, `() => {}`, `new (class C {})()`, `'str'`, `1`, `null`, `undefined` →
  **throws** `TypeError`.
- `ccn/R3` — `Object.create({ inherited: 1 })` carrying an own key → **throws**.
- `ccn/R4` — an already-built namespace → **throws**.
- `ccn/R5` — `{}` → **throws** `TypeError`,
  `'exports' must carry at least one own property`.
- `ccn/R6` — a source carrying `Symbol.toPrimitive` or `Symbol.toStringTag` → **throws**,
  naming the offending symbols.
- `ccn/B4` — `{ ...someNamespace }` → **accepted**, yielding a new namespace.

The check is `isPlainOrDictionaryObject` rather than the stricter `isPlainObject`, so the
`Object.assign(Object.create(null), {…})` bag qualifies alongside a literal (`ccn/A4`).
That prototype-less form is this repo's own house convention; refusing it would refuse the
shape a maintainer following `CLAUDE.md` would reach for.

A source with a custom prototype chain is refused **outright**, not read for its own keys
(`ccn/R3`). Worth stating, because "own keys only" is the natural guess.

An already-built namespace does not qualify as raw material (`ccn/R4`) — its brand
disqualifies it under both predicates. A namespace is a terminal artifact. Its _contents_
are still fair game, though: a spread drops the brand, so `{ ...ns }` builds a new
namespace happily (`ccn/B4`). That is a corollary of the rule, not an exception to it.

Reserved keys are rejected up front (`ccn/R6`) rather than left to collide with the
builder's own definitions later, which would report an internal redefinition instead of
the caller's actual mistake.

## B — Member resolution (`mem/*`)

Members are **resolved, not copied**. A data descriptor contributes its `value`; an
accessor has its getter invoked once, at build time, with `exports` as the receiver.
Either way the member lands as a frozen data property, so the namespace holds exactly one
member shape and no live accessor survives into it.

- `mem/A1` — `{ a: 1 }` → the member's descriptor is exactly
  `{ value: 1, enumerable: true, writable: false, configurable: false }`.
- `mem/A2` — a source member defined `{ value: 7, enumerable: false }` → readable as
  `ns.hidden`, but absent from `Object.keys`, `for…in`, `JSON.stringify`, spread and
  `Object.assign`; still listed by `Object.getOwnPropertyNames`.
- `mem/A3` — a source accessor's getter runs **exactly once**, during the call. A later
  change to the backing value is not reflected, and repeated reads do not re-invoke it.
- `mem/A4` — a getter reading `this.sibling` sees the sibling. It is invoked with `source`
  as receiver, not with the half-built target.
- `mem/A5` — a symbol-keyed member is included on the same terms, and listed by
  `Object.getOwnPropertySymbols`.
- `mem/A6` — an accessor member honors `enumerable` exactly as a data member does.
- `mem/A7` — a member may be anything the author exports: a function, `null`, `undefined`,
  a nested object.
- `mem/R1` — a setter-only accessor → **throws** `TypeError`,
  `'exports' member <key> must be readable`.
- `mem/R2` — an accessor carrying neither half (`{ get: undefined, set: undefined }`) →
  **throws**, same message.
- `mem/R3` — a symbol-keyed valueless member → **throws**, rendering the key as
  `Symbol(writeOnly)`.
- `mem/R4` — a source whose members are **all** valueless → **throws**.

`enumerable` is the one flag a member keeps from its source, and the only axis a caller
controls (`mem/A2`, `mem/A6`). Non-enumerable means invisible, not private: such a member
is fully readable and still appears in the own-key listings.

`mem/A3` is what makes the namespace a snapshot rather than a view. Nothing it exposes
re-enters the source afterward, so a later read cannot vary or throw.

In `mem/R3` the key is coerced with `String(key)`. A bare template interpolation would
raise `Cannot convert a Symbol value to a string` and report the wrong error entirely.

`mem/R4` is why an empty namespace is unreachable: the non-empty guard grants at least one
own key, and every key either writes a member or throws.

### Why a valueless member is refused rather than skipped

Both alternatives were considered and rejected.

Writing the key would be indistinguishable on read from a genuinely `undefined` export,
while still answering `in` and appearing in the own-key listings.

Leaving it off is the same defect one step quieter: a namespace missing a member its
author declared, which is the outcome this builder exists to rule out. Dropping one member
of ten is the worse of the two failures, because the caller receives something that looks
complete and only fails much later, at the one access that matters.

## C — The artifact (`ns/*`)

- `ns/A1` — `Object.getPrototypeOf(ns)` → `null`.
- `ns/A2` — `Object.isFrozen(ns)` and `Object.isSealed(ns)` → `true`;
  `Object.isExtensible(ns)` → `false`.
- `ns/A3` — `Object.prototype.toString.call(ns)` → `'[object CustomNamespace]'`.
- `ns/A4` — `String(ns)`, `` `${ns}` `` and `ns + ''` all → `"[namespace '<name>']"`.
- `ns/A5` — `+ns` → `NaN`.
- `ns/A6` — both structural symbols are
  `{ enumerable: false, writable: false, configurable: false }`.
- `ns/A7` — `{ ...ns }` and `Object.assign({}, ns)` yield an ordinary object: it answers
  `[object Object]` and has no own symbols.
- `ns/B1` — the freeze is **shallow**. A member holding an object exposes it unfrozen:
  `ns.inner.mutable = 2` succeeds.
- `ns/B2` — own-key order follows the ECMAScript rule: integer-like keys first in
  ascending numeric order, then string keys in insertion order, then symbols.
  `{ b: 1, 2: 2, a: 3, 1: 4 }` yields `['1', '2', 'b', 'a']`.
- `ns/B3` — the namespace has **no `toString`**, own or inherited. Every implicit
  conversion still succeeds — `String(ns)`, a template literal, `ns + '!'`,
  `[ns].join('')`, `JSON.stringify(ns)` — but an explicit `ns.toString()` throws
  `TypeError`, unless the author exported a member of that name.
- `ns/R1` — `isDictionaryObject(ns)` → **`false`**.

The three string forms agree (`ns/A4`) because all three engine hints answer the same
representation. Arithmetic stays honest anyway (`ns/A5`): the value has no numeric
meaning, so `+ns` is `NaN`.

The brand is hidden (`ns/A6`) so that identity does not travel on a copy (`ns/A7`). An
enumerable brand would ride along on a spread and hand back a plain object answering
`[object CustomNamespace]` — the builder forging its own mark.

The freeze happens last, after both symbol definitions, which a frozen target would have
rejected. It guarantees the namespace's own shape: which members exist, and that they
cannot be reassigned, redefined or deleted. It makes no claim about the values they hold
(`ns/B1`).

**No `toString` is a decision, not an omission (`ns/B3`).** Adding one would cost a third
reserved key — and a string-keyed one. Reserving `Symbol.toPrimitive` and
`Symbol.toStringTag` costs nothing, because no author legitimately exports those;
reserving `toString` would take an ordinary identifier out of the author's surface, and a
formatting module exporting `toString` is entirely reasonable. A package whose purpose is
to group the author's exports should not charge that rent to serve callers who write
`.toString()` where `String()` would do.

The current behavior is also strictly better than the artifact it models. A real ES module
namespace has a null prototype, no `toString` **and** no `Symbol.toPrimitive`, so
`String(moduleNamespace)` throws outright; ours converts in every implicit form. And an
author who exports `toString` gets it: the member answers `ns.toString()` while
`Symbol.toPrimitive` still governs `String(ns)`, so the two coexist rather than compete.

One consumer-tooling consequence follows and is not a defect in either party.
`@typescript-eslint/no-base-to-string` reports that a namespace stringifies as
`[object Object]`, because it reads the declared type and does not consider
`Symbol.toPrimitive`. The only type-level cure would be declaring a `toString` the runtime
does not have — a lie that would make a throwing call typecheck.

**`ns/R1` is correct, not a composition gap.** type-detection's dictionary check requires
a type signature of `'[object Object]'`, precisely so it can reject an object
hand-decorated with an own `Symbol.toStringTag` to lie about its `[[Class]]`. A branded
namespace is that shape by construction. A predicate admitting both would be the defect.
The recognizer a consumer actually needs is Open item 1.

## C — The `Symbol.toPrimitive` implementation (`prim/*`)

- `prim/A1` — all three hints the engine supplies (`'string'`, `'number'`, `'default'`)
  answer the same representation.
- `prim/R1` — any other hint → `undefined`, including inherited member names such as
  `'toString'`, `'constructor'`, `'valueOf'` and `'__proto__'`.
- `prim/B1` — a hint whose own `toString` throws → the throw **propagates**.

The lookup table is prototype-less, which is why the inherited names in `prim/R1` miss
rather than resolving to an inherited function.

`prim/B1` is reachable only by invoking the namespace's `Symbol.toPrimitive` directly. The
engine only ever supplies the three strings.

## D — Failure semantics (`fail/*`)

- `fail/A1` — the first blocker wins: `createCustomNamespace(42, 'not-an-object')` reports
  the **name** error, not the exports error.
- `fail/A2` — a per-member failure stops at the first offending key; a later key's getter
  does not run.
- `fail/A3` — a hostile `getOwnPropertyDescriptor` trap propagates its own error unwrapped
  (a `RangeError` stays a `RangeError`).
- `fail/A4` — a getter that throws propagates, unwrapped.
- `fail/A5` — a `Proxy` whose `ownKeys` lists a key its `getOwnPropertyDescriptor` does
  not describe → **throws** `TypeError`.
- `fail/B1` — the builder is **not transactional**: a call that throws has already run
  every getter up to the offending key.
- `fail/B2` — "first offending key" means first in **own-key order**. A source written
  `{ b: <setter-only>, 1: <setter-only> }` reports `member 1`, because the integer-like
  key sorts first (`ns/B2`).

The `TypeError` in `fail/A5` is not one the builder authors. The descriptor read returns
`undefined` and the immediate flag read fails on it. The error is real, and the message is
the engine's rather than a written one.

`fail/B1` is specified behavior, not an oversight. A validation pre-pass would have made
the valueless-member case all-or-nothing while a throwing getter stayed partial — two
behaviors for one class of problem. Failing at the first offending key keeps every
member-level failure alike.

## Type-level contract (`type/T*`)

Checked by `pnpm run typecheck`, not by a runtime vector.

- `type/T1` — `createCustomNamespace('t', { a: 1, s: 'x' })` returns
  `CustomNamespace & Readonly<T>`, so `ns.a` is `number` and `ns.s` is `string`, rather
  than collapsing to the `unknown` of the index signature.
- `type/T2` — an unknown key reads as `unknown` rather than erroring.
- `type/T3` — assigning to a member is a type error.
- `type/T4` — assigning to `[Symbol.toStringTag]` is a type error.
- `type/T5` — `T` is constrained to `object` rather than to an index-signature type, so an
  `interface` is accepted, and its members survive the intersection.

`type/T2` is what keeps `CustomNamespace` usable as a parameter type for any namespace.

`type/T3` and `type/T4` are asserted with `@ts-expect-error`, which fails in both
directions: if the assignment were permitted, the unused directive would itself error.

`type/T5` asserts both halves of the constraint choice. The accepted half passes an
`interface`-typed bag and reads a member back at its declared type; the rejected half
calls a generic constrained to `Record<PropertyKey, unknown>` under `@ts-expect-error`, so
the abandoned alternative stays executable rather than remembered. The `interface` itself
lives in `test/__types.d.ts`, because JSDoc's `@typedef` yields a type alias and
TypeScript gives an alias the implicit index signature an `interface` never gets — the
very difference under test.

## Realm-fixed captures (`cap/*`)

- `cap/A1` — each `#config` export is identity-equal to its intrinsic at module-load, so
  post-load mutation of the global `Object` cannot redirect what the builder reads or
  writes.
- `cap/A2` — `getOwnPropertyDescriptor` is the raw capture, not a throw-safe wrapper.

`cap/A2` is the deliberate half of the raw / throw-safe pairing, and the mechanism behind
`fail/A3`.

ADR #086 governs placement: a raw capture of a platform native stays `@internal` in the
package that holds it, and every package captures its own. A value-add is imported from
the type-detection root instead — the retyped `objectCreate`, and the curated
`frozenDataDescriptor` / `frozenEntryDescriptor` presets.

## Refuses to claim

These assert nothing. They are the scope the module declines, and they are prose rather
than vectors for exactly that reason.

- **It does not deep-freeze.** Member values are untouched (`ns/B1`).
- **It does not restrict what a member may be.** No arity check, no callable check, no
  expected relationship between a key and the function it holds. A namespace of constants
  is as valid as a namespace of functions.
- **It does not verify that `exports` is a module surface.** "The author's own exports at
  definition time" is the intended use and the justification for running getters. It is
  not a checked precondition.
- **It does not detect namespaces.** There is no `isCustomNamespace` here yet; see Open
  item 1.
- **It makes no cross-realm claim.** A namespace built in another realm has the same
  structural shape, but nothing here reads or compares realm identity. The module has no
  cross-realm surface because it has no predicate. The question becomes live only once a
  recognizer exists.

## Open items

1. **`isCustomNamespace` is owed.** `ns/R1` is why a consumer cannot use
   `isDictionaryObject` to recognize a namespace, and that behavior is correct, so the
   answer is a dedicated recognizer: structural, on null prototype, brand and `String()`
   shape, optionally with a realm `WeakSet` for same-realm certainty. Deliberately not
   built yet — the split between a generic half and any domain-specific half should be
   settled by a consumer that exists, not guessed from one that does not. The owner ruled
   on 2026-09-03 that no current code is blocked by its absence.
2. **Spec filename.** This file is named for the package, because its entry module is
   `src/index.js`, whereas every sibling spec in the workspace is named for a module
   (`FUNCTION`, `BOUND`). If a second module here ever earns a spec, the convention should
   be revisited rather than extended by accident.
3. ~~**`type/T5` is unverified.**~~ **RESOLVED 2026-09-04** — it earned the fixture; see
   Resolved item 3. Kept in place so the numbering stays stable.
4. **No `docs/architecture/` exists for this package.** This spec currently carries the
   mental model itself. If an architecture doc is written, the "Why this spec is shaped
   differently" section should point at it rather than duplicate it.

## Resolved items

1. **The throw-contract inversion was the first thing this spec had to settle.** Writing
   it against the shared README made plain that "throw-safety is a universal invariant" is
   a _type-detection_ invariant, not a workspace-wide one. Stating the inversion
   explicitly, with its reason, is what keeps a reader from filing this module as a rule
   violation. The vector vocabulary follows from it: `R` means refused, and each module
   defines the observable form refusal takes.
2. **Three claims were falsified during the pre-spec audit and fixed before drafting**
   (`7842905`). One was a stale "a member with no readable value is skipped" in
   `src/config/`. The sweep had missed it because the phrase wraps across two lines and
   the claim matcher was line-based until `6b7bf07`. The second was the non-transactional
   failure behavior, undocumented until it became `fail/B1`. The third was an understated
   summary line on `aggregateNamespaceTarget`.

   **The spec was deliberately not written first.** A spec distills documentation, and
   documentation that has not been executed is a rumor.

3. **`type/T5` is verified after all** (Open item 3, 2026-09-04). The obstacle was
   believed to be structural — a real `interface` cannot be written in JSDoc, and this
   package authors no `.ts` sources — but the second half of that does not follow: a
   declarations-only `test/__types.d.ts` needs no `.js` twin, and the fixture reaches it
   by a relative specifier, as test-support modules already do elsewhere. The vector now
   asserts both halves, the accepted constraint and the rejected one.

   Verifying it mattered more than the one vector. A JSDoc `import()` that fails to
   resolve degrades to `any` in silence, so the first attempt compiled clean while
   asserting nothing at all; only mutating the interface member — and getting `TS2322` —
   showed the reference was real.

4. **The vector count was wrong** (2026-09-04). The suite banner read "52 of the 53"; the
   file has always held 54, and 53 were asserted before `type/T5` joined them. The banner
   predates `ns/B3` and was not revised when that vector was appended. Recorded rather
   than quietly corrected, because an uncounted count is how a spec starts drifting from
   the suite that cites it.

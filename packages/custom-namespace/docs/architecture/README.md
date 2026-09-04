# custom-namespace — Architecture

A current-state conceptual map of `@species-js/custom-namespace`. The decision log
(`../decisions/`) answers _why_ the code looks the way it does. The spec
(`../spec/CUSTOM-NAMESPACE.spec.md`) answers _what is true_, as frozen vectors. This
directory answers _how it works_. **No verdict is stated here** — a verdict belongs to the
spec, where it can be executed, so claims below cite the vector that pins them.

The sibling packages keep one file per module and use `README.md` as an index. This
package has one documented module, so the map lives here directly rather than in a single
file behind an index of length one — the same reasoning ADR #097 applied to the
barrel/`public` split. `#config` holds this package's own realm-fixed captures and is not
documented separately; #086 explains why every package captures its own.

## Mental model

**A one-way funnel.** Exports go in, a frozen snapshot comes out, and nothing connects the
two afterward. `createCustomNamespace` is the only entry; the three helpers it composes
(`toPrimitive`, `resolveNamespaceMember`, `aggregateNamespaceTarget`) are module-local and
unexported, because every branch they carry is reachable through the entry.

The artifact is modeled on an ECMAScript module namespace, and the resemblance is
load-bearing rather than decorative: null prototype, non-extensible, a
`Symbol.toStringTag` that does not travel on a copy. Where the two differ, the difference
is deliberate — a real module namespace holds live bindings, and this one holds values
that were read once.

## The build, in order

Four argument gates, then a reduce, then two brands, then the freeze.

1. **`name` must be a string** (`ccn/R1`). A bad type throws; a degenerate value does not
   — `'   '` trims to `''` and yields `[namespace '']` (`ccn/B1`).
2. **`exports` must be a plain object or a prototype-less dictionary** (`ccn/R2`,
   `ccn/R3`), checked with `isPlainOrDictionaryObject` rather than the stricter
   `isPlainObject` so the `Object.assign(Object.create(null), …)` form this repo writes by
   convention qualifies. An already-built namespace does not qualify either (`ccn/R4`) —
   its brand disqualifies it as a dictionary, and a namespace is a terminal artifact
   rather than raw material.
3. **`exports` must carry at least one own key** (`ccn/R5`).
4. **`exports` must not carry either reserved symbol** (`ccn/R6`), because the builder
   defines both itself.

The order is contract, not incident: a caller fixing one rejection must not be handed a
different one for the same mistake. Per-member failures come afterward, in own-key order.

## RESOLVE, not copy

The idea the rest follows from. Every own key of `exports` is reduced to a **value** once,
at build time — a data property by its `value`, an accessor by invoking its getter with
`source` as receiver — and written as a frozen data property.

So a namespace is a snapshot, never a view. A getter runs **exactly once**, during the
call; a later change to its backing value is not reflected, and repeated reads do not
re-invoke it (`mem/A3`). No live accessor survives into the artifact, which means a read
afterward cannot re-enter the source, vary, or throw. Invoking the getter on `source`
rather than on the half-built target is what lets one that reads a sibling member still
find it (`mem/A4`).

Running author code at build time is only acceptable because `exports` is expected to be
the author's own module surface at definition time — which is also what makes failing
loudly the cheap option.

## The one flag the caller keeps

`enumerable` is preserved from the source; `writable`, `configurable` and the accessor
pair are overridden (`mem/A1`, `mem/A2`, and `mem/A6` for an accessor member honoring it
on the same terms). The asymmetry is a difference in kind rather than a compromise. The
overridden flags are what a namespace _is_ — read-only, sealed, resolved — so overriding
them discards nothing the author meant. `enumerable` carries something else: authorial
intent about surface versus internal, orthogonal to everything the namespace enforces. An
object literal makes every member enumerable, so honoring it costs the ordinary caller
nothing, while reaching for `Object.defineProperty` to clear it is never accidental.

## Why this module throws where type-detection returns `false`

The one thing a reader arriving from the sibling packages has to re-learn. Throw-safety is
a **type-detection** invariant, not a workspace-wide one: a predicate that throws is a
predicate that cannot be trusted in a guard. This package is a builder, and the inversion
follows from what a builder can fail at.

A predicate asked about a hostile value has a correct quiet answer — `false`. A builder
handed an unreadable source has none: it can only produce a namespace that looks whole and
is not. So the reads over `exports` use the **raw** key and descriptor forms rather than
type-detection's `getSafe*` twins, and a getter is invoked unguarded (`fail/A3`). That is
the deliberate half of the raw/throw-safe pairing.

The rule has no exception. A member with no readable value at all — a setter-only accessor
(`mem/R1`), or one carrying neither half (`mem/R2`) — is refused on the same ground rather
than quietly left off, whether it is one member among many or all of them (`mem/R4`). Both
quieter alternatives were considered: writing the key would be indistinguishable on read
from a genuinely `undefined` export while still answering `in`, and omitting it is the
same defect one step quieter. Failing at the first offending key, in own-key order, is
what keeps every member-level failure alike.

The cost is that failure is **not transactional** (`fail/B1`). A build that throws partway
has already invoked the getters it reached. Nothing observable escapes — the half-built
target is unreachable — but side effects in those getters have happened.

## Both structural symbols are hidden

`Symbol.toPrimitive` and `Symbol.toStringTag` are defined with the hidden descriptor
preset, never the visible one (`ns/A6`). A real module namespace declares its
`Symbol.toStringTag` non-enumerable for the same reason: **identity must not travel on a
copy.** Enumerable brands would ride along on `{ ...namespace }` and hand back a plain
object answering `[object CustomNamespace]` — the builder forging its own mark (`ns/A7`).
Property lookup ignores `enumerable`, so both still function.

The freeze comes last, after both definitions, which a frozen target would have rejected.

## Why there is no `toString`

A `toString` of its own would have to join the reserved-key set as its first **string**
key, and that set is what a source may not carry. The two symbols cost an author nothing —
nobody legitimately exports them. `toString` is an ordinary name a formatting module might
well export, so reserving it would take a real name away.

Nothing is lost by leaving it out. `Symbol.toPrimitive` outranks `toString` in every
implicit conversion, so `String(ns)`, a template literal, `ns + '!'`, `[ns].join('')` and
`JSON.stringify(ns)` all succeed; only an explicit `ns.toString()` throws, and only when
the author exported no member of that name (`ns/B3`). All three hints the engine supplies
answer the same representation, so a namespace has exactly one primitive form (`prim/A1`).

## Cross-realm

The module makes no cross-realm claim, and the reason is structural rather than an
omission: cross-realm questions are asked _about_ values by predicates, and this package
has none. A namespace built in another realm has the same shape, and nothing here reads or
compares realm identity.

What the module does hold is realm-fixedness of its own tools. `#config` captures its
intrinsics once at module load (`cap/A1`), so later tampering with the global `Object`
cannot redirect what the builder reads or writes. Per #086 those raw captures stay
`@internal` and are not imported from type-detection; a value-add — the retyped
`objectCreate`, the curated `frozenDataDescriptor` / `frozenEntryDescriptor` presets — is.

## Open architectural questions

- **Recognition is declined, not missing** (ADR #098). The caller holds what the builder
  returned, and a structural check could only report a shape rather than an origin. The
  re-open trigger is a namespace crossing a package boundary as public API, or two copies
  of this library in one dependency tree — the cases where neither a reference nor a
  `WeakSet` answers.
- **Whether `#config` should ever become a published subpath.** It is inlined by the
  bundler today and the `exports` map has a single `"."` entry, so Node's own resolution
  blocks a deep import. type-detection publishes its `config`; this package has not needed
  to, and the asymmetry is unexamined rather than intended.
- **Whether the reserved-key set could ever need a string key.** It holds only symbols
  today, which is what keeps the rule cheap for authors. Any string added to it takes a
  legitimate export name away, so the `toString` reasoning above would have to be re-run
  for that name specifically.

# type-identity — Architecture

A current-state conceptual map of `@species-js/type-identity`. The decision log
(`../decisions/`) answers _why_ the code looks the way it does. The spec
(`../spec/TYPE-IDENTITY.spec.md`) answers _what is true_, as vectors. This directory
answers _how it works_. **No verdict is stated here** — a verdict belongs to the spec,
where it can be executed, so claims below cite the vector that pins them.

The sibling packages keep one file per module and use `README.md` as an index. This
package has one documented module, so the map lives here directly rather than behind an
index of length one. `#config` holds this package's own realm-fixed captures and is not
documented separately; ADR #086 explains why every package captures its own.

## Mental model

**Two writers and one reader, over three property slots.**

`instanceof` asks whether a value was built by _this_ constructor object. Across a realm
boundary — an iframe, a worker, a second copy of the same module — the answer is no even
for a value of exactly the right type, because the constructor a checker holds is not the
constructor the value came from. Identity comparison fails; **structure survives**. So
this package installs structure that cannot be rewritten, and reads it back without
trusting anything.

The three artifacts divide along that line:

- `defineStableTypeIdentity` freezes three slots at once.
- `brandFunctionName` freezes one of them, `name`, on any callable.
- `doesCarryStableTypeIdentity` reads all three back, inertly.

The asymmetry between writing and reading runs through everything else. A writer can
report _why_ it refused, so its contract is an ordered rejection list and it never throws.
A reader has no second channel, so every failure — including a hostile trap mid-read —
collapses to `false` (`carry/R8`), and no getter is invoked on the way there (`carry/B2`).

## The three slots, and why those three

| slot                 | where                 | what it carries            |
| -------------------- | --------------------- | -------------------------- |
| `name`               | the constructor's own | the type's name, frozen    |
| `constructor`        | the prototype's own   | the back-reference, frozen |
| `Symbol.toStringTag` | the prototype's own   | a getter returning the tag |

Together they answer the two questions a cross-realm checker can ask without holding a
reference: _what does `Object.prototype.toString` say_, and _what does the resolved
constructor call itself_. The back-reference is what lets the check start from either side
of the relation — a constructor is inspected directly, any other value through its
`[[Prototype]]` and its resolved constructor (`carry/A1`, `carry/A2`).

All three land frozen: non-writable, non-enumerable, non-configurable for the two data
properties; non-enumerable, non-configurable and **setter-less** for the accessor
(`define/A6`). An accessor property has no `[[Writable]]` attribute at all, so
non-configurability is the whole of what freezing means for it — and the missing setter
supplies the write-protection that non-writability supplies for a data property.

**The tag is a getter rather than a data property**, and the value is closed over at
install time (`define/A7`), so no later code can make it answer differently. The read-back
requires exactly that shape — getter present, setter absent — and refuses a data-property
tag or a getter/setter pair (`carry/B1`).

## Order of operations

### The writes: tag, constructor, name

`name` goes last because it is the irreversible one. Freezing it closes the slot, so a
failure afterward could not be retried. Running it after both prototype writes means an
ordinary failure leaves the constructor object untouched (`define/B7`).

The entry is **not transactional**, and the sequence is what bounds the damage. Three
shapeability probes run before any write, which makes a mid-sequence failure unreachable
for ordinary targets; what survives is a hostile prototype that answers a probe truthfully
and then refuses the define. That leaves the tag installed and the constructor clean — a
state that is loud rather than silent, because the retry then fails on the now-unshapeable
tag (`define/B7`).

### The gate: arguments before slots

Twelve conditions, first blocker wins, and the order is contract rather than incident: a
caller fixing one rejection must not be handed a different reason for the same mistake.
The two halves are

1. **arguments** — is it a constructor at all, is it a shape this package writes to, are
   the identifiers usable (`define/R1`–`define/R6`);
2. **slots** — can each of the three still be shaped, and does the prototype read cleanly
   (`define/R7`–`define/R12`).

Validity is settled before shapeability, so a bad argument is reported even against a
target that could not have been written to anyway (`ord/A3`, `ord/A4`).
`brandFunctionName` runs the same rule over five conditions (`ord/A7`).

## Shape, not origin

`isSupportedConstructor` is the union of the two constructor shapes this package writes
to: an **ES3 function**, whose own `prototype` descriptor is writable, and a
**`class`-syntax constructor**, whose own `prototype` is non-writable and whose source
begins with `class`.

It is a shape test throughout, and the consequences follow from that rather than from a
policy:

- A built-in fails on the source read — `function Foo() { [native code] }` (`shape/R1`).
- A bound newable fails earlier, on the descriptor: `bind` strips the own `prototype` slot
  both shapes are read from (`shape/R2`).
- A `Proxy` over an ES3 function **passes**, while one over a class does not, because
  `Function.prototype.toString` reports native code for any proxy (`define/B3`).
- A bound newable handed an own writable `prototype` **passes**, and freezes successfully
  onto an object `new` never consults (`define/B4`).

The newability half — the `[[Construct]]` probe — is hoisted to the call site rather than
composed in, because it allocates a `Proxy` and runs a `new` on every call. The parameter
type carries the resulting precondition, so `tsc` enforces what the body assumes
(`shape/B2`, `type/T10`).

## Identifiers: one helper, three parameters

`getIdentifierAsSafeResult` decides `constructorName`, `taggedType` and `fctName` alike,
with `parameterName` the only thing that varies between their rejections. It admits a
primitive string or a direct boxed `String`, unwraps to the primitive, then trims
(`ident/A1`–`ident/A3`).

The unwrap is load-bearing three times over: `new String('') === ''` is `false`, so an
empty wrapper would walk past the emptiness check; `Object.prototype.toString` ignores a
tag that is not a primitive string; and the warning that reports a diverging name and tag
compares wrapper identities rather than text until both sides are primitives
(`define/A5`).

Two error classes carry two different mistakes — `TypeError` for "that was not a name at
all", `RangeError` for "you meant a name and gave an empty one" (`ident/B2`).

**Presence is read from the call's arity, never from the value.** `taggedType` arrives
through a rest parameter, and `args.length` decides whether it was supplied before
anything asks whether it is valid. One predicate answering both questions would read every
non-string as omitted, silently defaulting a `42` that a caller plainly meant as a tag
(`define/R5`, `ord/A6`). ADR #079 governs; the `.d.ts` states the same rule statically as
`[] | [string]`, which refuses an explicit `undefined` at compile time (`type/T2`).

## The error-cause capability seam

Wrapped reasons need `Error`'s `cause` option, which post-dates this package's ES2020
floor. The two-argument form **parses** on every engine and an engine without support
ignores the second argument silently, so support cannot be inferred from syntax — the
observable effect is probed instead, once, at module load (`cause/A1`, `cause/A2`).

Two details make the seam testable rather than theoretical. The constructor arrives as an
**argument** rather than being read from the global, so a stub that ignores its options
bag selects the fallback on an engine whose native `Error` would not — otherwise the
fallback is dead code everywhere `cause` already works. And a probe that **throws** counts
as a negative answer rather than an error to report, which is what makes the probe total
instead of guarded (`cause/A3`).

The stand-in installs `cause` under the flags the native form uses, so the errors this
package builds are indistinguishable from native ones (`cause/A4`), and it distinguishes
an absent `cause` from one explicitly set to `undefined` exactly as the native does
(`cause/A5`). Its trigger is narrower — a plain-object bag's own key, where the native
accepts any object and the prototype chain — which no call path here can reach
(`cause/B1`).

## What the freeze does not cover

Stated positively so the guarantee stays legible: **three slots, and nothing else.**

- **Objects stay extensible.** New prototype members and new statics can still be added
  (`define/B1`).
- **The constructor's `prototype` pointer is not frozen.** It is read and never written,
  so an ES3 function's stays assignable — that writability is the property identifying the
  shape. Reassigning it substitutes an unfrozen prototype, which replaces the type rather
  than defeating the freeze: the frozen prototype and every value already built from it
  keep both tag and verdict (`define/B2`, `carry/B6`).
- **A value's own tag is not guarded.** An instance may shadow the inherited
  `Symbol.toStringTag` and change what `Object.prototype.toString` answers for itself; the
  verdict, read off the prototype, is unmoved (`carry/B4`).
- **Identity does not inherit.** A subclass's instances answer the parent's tag through
  the chain, and answer `false` to the check, until the subclass is frozen in its own
  right (`define/B6`, `carry/B5`).
- **Authenticity is not claimed.** A hand-forged shape answers `true`; the check reports
  that an identity is frozen, never who froze it (`carry/A4`).

## Cross-realm, concretely

Nothing in the implementation uses `instanceof` or compares constructor identity — the
read path is descriptor reads, the write path descriptor reads plus three defines
(`realm/B1`). That is the whole mechanism behind the package's reason to exist, and it is
checkable by grep: the word occurs twice in `src/index.js`, both times in prose explaining
why the operator is avoided, and never in code.

Consequences: a constructor made in another realm freezes exactly as a local one does, and
its name and tag read back from inside that realm as well as from ours (`realm/A1`); a
foreign built-in is refused for the same shape reason a local one is (`realm/R1`).

## Realm-fixed captures

`#config` captures `globalThis` plus three `Object` statics at module load, so a later
reassignment of the global `Object` cannot redirect what the package reads or writes
(`cap/A1`). `getOwnPropertyDescriptor` is held **raw**, not throw-safe: the module-local
reader wraps it so a trap that threw stays distinguishable from an absent descriptor,
which is what separates conditions 8 and 9 (`cap/A2`).

ADR #086 governs placement — a raw capture of a platform native stays `@internal` in the
package holding it, while a value-add is imported from type-detection's root instead. That
is why `objectHasOwn`, `frozenEntryDescriptor` and `sealedEntryAccessor` cross the package
boundary and the four captures do not.

## The delivery seam

`exports["."]` resolves to the curated `src/public.{js,d.ts}`, which names the six
published exports one by one. `#index` is the module itself and additionally carries four
`@internal` exports — the two parameter verifiers, the capability seam and its constructor
type — so their admissions and refusals can be asserted directly. ADR #099 is the
invariant: whatever `exports["."]` resolves to is the public surface, and nothing
`@internal` may be exported from it. `surface:check` enforces it statically from the tags;
`test/index.test.js` asserts it at runtime on the object a consumer imports.

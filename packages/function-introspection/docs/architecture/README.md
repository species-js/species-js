# function-introspection — Architecture

A current-state conceptual map of `@species-js/function-introspection`. The decision log
(`../decisions/`) answers _why_ the code looks the way it does, as
chronologically-numbered ADRs. The specs (`../spec/`) answer _what is true_, as frozen
admit/reject vectors and standing laws. This directory answers _how it works_, one file
per module.

Each module file opens with the mental model a contributor needs before reading the code,
then the patterns that code embodies, and closes with the architectural questions it has
not answered. **No file here states a verdict** — a verdict belongs to a spec, where it
can be executed.

## Modules

| Module     | File                       | Surface                                                                                                  |
| ---------- | -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `#bound`   | [bound.md](./bound.md)     | `doesIndicateBoundFunction`, `doesStronglyIndicateBoundFunction` — evidence of `Function.prototype.bind` |
| `#arrow`   | [arrow.md](./arrow.md)     | `isArrowFunction`, `isAsyncArrowFunction`, `isAnyArrowFunction`                                          |
| `#concise` | [concise.md](./concise.md) | `isPlainConciseMethod` plus the async, generator and async-generator flavors, and their union            |
| `#utility` | [utility.md](./utility.md) | The shared source reader, its condensate, and `Proxy`-constructor identification                         |

`#config` holds this package's own realm-fixed captures and is not documented separately;
#086 explains why each package captures its own.

## The organizing idea: one question, two trust grades

The package answers a single question — **what kind of callable is this?** — and it
answers at whatever strength the evidence supports. That is #087's ruling made structural:
a package is chosen by a predicate's role, not by how trustworthy it is.

So the modules divide by how much they can prove, and the division is visible in their
names:

- **`bound` reads MARKS.** `[[BoundTargetFunction]]` is unobservable, so nothing here is
  proof. Every export is `doesIndicate…`, returns a plain `boolean`, and grants no
  narrowing.
- **`arrow` and `concise` read PROOF.** Admission rests on `[[SourceText]]`, a
  spec-defined tag, or an own-`prototype` read, and any ambiguity is refused rather than
  guessed. Every export is `is…`.

A reader can therefore tell from a call site how much the answer is worth. #088 places the
grade in the identifier; #090 states what the unmarked `is…` costs to earn.

## The three evidence classes

Every predicate here draws on one or more of:

1. **`[[SourceText]]`**, read through a realm-fixed `Function.prototype.toString`. The
   only channel that distinguishes an arrow from a concise method, since nothing
   structural does. Binding, `Proxy`-wrapping and every built-in erase it — they stringify
   to the anonymous `[native code]` form.
2. **The spec-defined tag** — `[object AsyncFunction]` and its siblings. Unforgeable, and
   it travels across realms. Used to settle what source alone cannot.
3. **Slot and descriptor reads** — an own `prototype`, a `[[Construct]]` slot, an own
   `name`. The first two are unforgeable in the direction that matters; `name` is not,
   which is exactly why it grades `bound` down.

## Cross-cutting patterns

Each module file carries the patterns it uses rather than deduplicating them here. That
follows type-detection's convention, and for the same reason: a shared document earns its
place when a second package adopts a pattern, not before.

Two patterns run through more than one module and are worth naming at this level.

**Read the head, never the body.** A method that returns an arrow is classified by its own
head. This is what removes the need for a lexer, balanced-paren counting or regex-literal
handling — and an early attempt at all three was reverted once the head-only insight
landed. `arrow` and `concise` both depend on it.

**Reach a flavor tag only where it will agree.** type-detection's tag predicates are cheap
when they succeed and roughly two orders of magnitude dearer when they refuse, because a
refusal walks a whole multi-layer pipeline. So the cheap source shape decides first. The
deliberate exception is `isFunction`: it is a `typeof` test, priced the same either way,
and it keeps a non-callable away from a source read whose refusal costs a caught
exception. Guarding callability early and reaching a flavor tag late are separate rules —
the second does not follow from the first.

## Open questions

Module files close with their own. The package-level one is whether this package publishes
subpaths at all: `./bound` exists, `arrow` and `concise` are reachable only through the
barrel, and that asymmetry is undecided rather than intended.

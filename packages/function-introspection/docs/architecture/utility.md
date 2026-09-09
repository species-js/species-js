# function-introspection / utility

## Mental model

Two of this package's three modules classify by reading source. `utility` is the layer
they read through, and it carries no classification logic of its own. It answers two
questions:

- **What does this callable's source look like, normalized?**
- **Is this callable the `Proxy` constructor?**

It sits below `bound` and `concise` in the dependency graph, mirroring type-detection's
module of the same name.

## Why condensation exists at all

Engines disagree about whitespace in `[[SourceText]]`. V8 renders a native function as
`function () { [native code] }`; JavaScriptCore and SpiderMonkey insert newlines; others
use tabs. A comparison against any one of those spellings is a comparison against one
engine.

Condensing removes whitespace adjacent to `(`, `)`, `{`, `}`, `[`, `]` and leaves every
other run intact. Every engine's LAYOUT then collapses onto one string, and **that is what
makes the `[native code]` marker portable**. It reaches no further: what an engine puts
between `function` and `(` is its own choice, and no amount of whitespace condensing
normalizes a name slot.

Two details of that rule are load-bearing rather than incidental:

- **The interior space in `[native code]` is preserved.** Without it the marker would fuse
  into `[nativecode]`, a legal identifier a concise method can carry as an array literal —
  a forgery needing no `Proxy`.
- **A name survives condensation.** `function max() { [native code] }` does not reduce to
  the anonymous form. On V8 and SpiderMonkey that is what lets `bound` tell a bound
  built-in from the native it was bound from, since only the unbound one carries a name.
  On JavaScriptCore it does not, because that engine renders the bound target's name too —
  `Math.max.bind(null)` and `Math.max` are the same string there (probe A8). What the
  condensate preserves is real; which values it separates is the engine's choice.

## Two readers, and why both

The module exposes the condensed source twice, and the duplication is deliberate.

`getCondensedFunctionSource` takes a **callable** and composes the read with the
condensate. `bound` uses it.

`getFunctionSourceCondensate` takes a **string**. `concise` uses it, because it has
already read the source once and will not pay a second `toString`. The string-taking form
has a second purpose that the callable-taking one cannot serve: it lets engine-specific
spellings be exercised under a single-engine test runner. The JavaScriptCore and
SpiderMonkey forms are unreachable through the callable in Node, and they are the reason
this export exists.

## The absorption is a guarantee, not an affordance

The source read goes through this package's own realm-fixed capture of
`Function.prototype.toString`, never through the value's own. A function whose instance
`toString` was replaced or deleted still yields its real source. #086 explains why each
package captures its own.

That read is throw-safe: a non-callable produces `undefined` rather than propagating a
`TypeError`. **Callers must not treat that as a guard.** The exception is absorbed by
_catching_ it, and an engine-thrown exception is roughly two orders of magnitude dearer
than the `typeof` test that would have prevented it. Every predicate in `arrow` and
`concise` therefore narrows with `isFunction` before reading source. The absorption exists
so a hostile callable cannot make a predicate throw — not so callers can skip a check.

## Identifying the `Proxy` constructor

`bound`'s first mark would otherwise fire on `Proxy` itself, which holds a construct slot
and no own `prototype`. Subtracting it takes two steps, cheap one first.

**Identity** settles the local realm in one reference compare. **Descriptor shape**
settles every other: an own `name` of `'Proxy'`, an own `length` of `2` or a callable own
`revocable`, and the named native source form. Structural rather than nominal, which is
what lets it recognize a foreign `Proxy` it has never seen.

One branch of that shape check is unreachable under V8 — every real `Proxy` has
`length === 2` and short-circuits first, while the named-native source check blocks any
fake. It is documented as deliberately uncovered, and a test should not be contorted to
reach it.

## Open architectural questions

**`hasProxyConstructorShape` has a single consumer**, `doesMatchProxyConstructor`.
Shared-layer code with one consumer is worth re-examining, though it is defensible here:
it answers a general question about the `Proxy` constructor and is separately testable.

**Whether this module belongs in type-detection — DECLINED 2026-09-09, with a trigger.**

Raised as: type-detection is the foundation every downstream project depends on, and
`function-introspection` already imports `getFunctionSource` from it — so wouldn't the
source-normalization utilities be better placed there, reachable without a second
dependency?

Declined, on **#087's test**. Placement is decided by structural ROLE — what a package's
own `src/` composes from — and nothing in type-detection's would compose from a
NativeFunction-grammar normalizer. It has `getFunctionSource` because two class predicates
need it; it has no notion of function _forms_, which is this package's whole subject. By
the same measure the condensate is load-bearing here: `bound` and `concise` both build on
it.

The argument for moving was **reach**, and #087 considered that criterion by name and
rejected it: the downstream projects that would supply the evidence do not exist, it makes
placement a moving target, and it defers the decision until the move is a breaking change
on two public surfaces. Note that the entry replaced here proposed a version of the same
thing, promoting the module upward once a third package wanted it — consumer-count
reasoning wearing an anti-duplication coat. It is paraphrased rather than quoted, so the
retired wording stays swept. The DRY instinct behind it is sound; the placement rule it
implied is not.

There is also a coupling argument that stands on its own. The condensate's contract —
preserve the interior space of `[native code]` so the marker stays unforgeable, collapse
rather than remove — is justified entirely by this package's threat model. Moving the
function without `CONDENSED_NATIVE_SOURCE_FOUNDATION` splits one contract across two
packages; moving both puts bound-function rendering knowledge into the package that does
not classify function forms.

**The trigger is observable, not event-shaped:** if type-detection's own `src/` ever
composes from the condensate, role has changed and the question reopens. Reach never
reopens it, however many downstream projects import it.

# type-detection / utility

## Mental model

The utility module hosts cross-realm-safe primitives that feed the domain-specific
predicates: descriptor walks (`getNextAvailablePropertyDescriptor` and its throw-safe
wrapper `getNextAvailableSafeDescriptor`), inert method and accessor probes
(`hasInertMethod`, `hasInertGetter`, `hasInertSetter`, `hasInertValue`), tag and
type-signature readers (`getTypeSignature`, `getTaggedType`), the inert constructor walk
(`getDefinedConstructor` and `getDefinedConstructorName` — decisions #047, #054–#059) plus
the generic verified-name reader (`getVerifiedOwnName`), and the user-facing type-name
resolver (`resolveType`).

The discipline is uniform: every property read is descriptor-based, accessor invocation is
deliberately avoided, and — since decision #056 — the descriptor-walk reads are
throw-safe: a hostile `getOwnPropertyDescriptor` / `getPrototypeOf` Proxy-trap yields the
"couldn't-determine" sentinel (`undefined` / `false`) rather than propagating, so a
type-guard always answers. These are two orthogonal properties — getter-inertness (never
invoke an accessor, named `Inert` on the `hasInert*` probes) and throw-safety (swallow a
hostile trap, named `Safe`) — which #073 gave distinct vocabulary and an explicit
`/* @@throw-safe */` source marker enumerating the throw-safe set (the utility test-round
oracle). The helpers compose into the predicates the type-domain modules export. The
module sits below every domain in the dependency graph and carries no domain-specific
knowledge of its own.

## Own-`prototype` predicates

Three throw-safe predicates read a value's own `prototype` descriptor — never the
inheritance chain — to answer the ES3-function-versus-class question structurally.
`hasOwnPrototype` reports whether an own `prototype` descriptor exists at all (an arrow
function, whose `prototype` is inherited from `Function.prototype`, answers `false`).
`hasOwnWritablePrototype` and `hasOwnNonWritablePrototype` are the exact complements over
values that own one: an `ES3Function`'s own `prototype` is `writable: true`, a
`ClassConstructor`'s (custom or built-in) is `writable: false` — the sole spec-given
discriminator between the two. A value with no own `prototype` answers `false` to both (a
missing descriptor's `?.writable` is `undefined`, matching neither).

These are the structural tells that `#function`'s `isES3Function` (→
`hasOwnWritablePrototype`) and `isClass` (→ `hasOwnNonWritablePrototype`) delegate to.
Like every read here the descriptor access is throw-safe: nullish input and a hostile
`getOwnPropertyDescriptor` trap alike yield `false`, never a throw.

## Own-property shapeability

`canOwnPropertyBeShaped` answers whether the own-property slot at a key can still take an
arbitrary descriptor. A property's **shape** is its descriptor form — its kind (data or
accessor) and its flags, never its value. That distinction is the whole design: a
`configurable: false` property has a frozen shape and, if it is also writable, a value
that still moves freely.

It carries one arm per branch of `Object.defineProperty`, because the operation itself
branches. An **absent** key succeeds or fails purely on `[[Extensible]]`; a **present**
key succeeds or fails purely on `configurable`. Mirroring that split is what makes the
answer exact rather than approximate — the earlier single-arm form read
`configurable !== false` for both and was therefore optimistic on absent keys, which
#081's reliability tenet does not permit (ADR #094). Both flags are one-way doors, so a
`false` is permanent for that slot; a re-check can never turn it back into a `true`.

The realm-fixed captures are the module's usual discipline: `getOwnPropertyDescriptor`
from `#config`, and a module-local `Object.isExtensible` taken from the same
`globalContext`. Neither is exported, so #086's "realm-fixed captures stay `@internal`"
holds trivially. The descriptor read is wrapped, making the predicate `@@throw-safe`: a
hostile `getOwnPropertyDescriptor` trap yields `false` rather than propagating — the
cautious answer, since absorption cannot distinguish "sealed" from "unreadable".

Deliberately NOT a member of the `hasOwn*` family. Those assert that a property exists and
then qualify it; this reports whether a slot is malleable, so an absent key on an
extensible target answers `true` where every `hasOwn*` answers `false`.

## Type Resolution

`resolveType` is the single public composer of the constructor-name and the tagged-type
signals. It codifies a two-axis dispatch rule.

**Axis 1 — PascalCase-leading constructor name wins outright.** Checked via the
module-local `regXStartsWithUpperCase = /^\p{Lu}/u` regex. Every built-in and every
well-written user class carries a Unicode uppercase-leading name; when present, it is the
most precise type signal available and the tag is not consulted.

**Axis 2 — Non-empty lowercase name beats the uninformative `'Object'` tag.** A lowercase
name (e.g., `'foo'` from `function foo () {}`) carries more information than the
structural `'Object'` tag, which by itself says only "this is an object." In every other
conflict the tag wins, including the anonymous-empty-name case (`name === ''`), where the
empty string carries no information and the tag is the only honest signal.

The dispatch composes with #047's tamper-resistant `getDefinedConstructor` walk: a
`Symbol.toStringTag` override on a value whose constructor name is PascalCase (the common
spoofing surface) is short-circuited at the first guard, and a tampered `constructor` data
property on the value cannot influence the read in the first place. The function's output
is uniformly grounded in the structural type rather than in user-supplied overrides. See
decisions #047 (inert constructor walk) and #048 (lowercase-name precedence).

## Constructor resolution

`getDefinedConstructor` / `getDefinedConstructorName` resolve a value's structural
constructor through an inert, tamper-resistant pivot-and-walk (decision #047): callable
values are walked from themselves, non-callable values from their `[[Prototype]]`, so a
user-supplied own `constructor` data property cannot influence the result. Three
refinements layer on the #047 walk:

- **`assumePrototype` option (decisions #047, #054).** When the caller knows the input IS
  a real prototype object (e.g. the result of `getPrototypeOf(instance)`),
  `{ assumePrototype: true }` reads the prototype's OWN `constructor` (ECMA-262 §10.2.6)
  instead of walking up. The option lives on `getDefinedConstructor` and threads through
  `getDefinedConstructorName`; its `assumePrototype` call sites are the four
  `isAlienRealm{X}` cross-realm seams — `isAlienRealmPlainObject` (`#object`),
  `isAlienRealmPromise` (`#thenable`), and `isAlienRealmEventTarget` /
  `isAlienRealmAbortSignal` (`#evented`) — each resolving the constructor once from the
  threaded `[[Prototype]]`.
- **No cross-call memoization; intra-call threading (decision #059).**
  `getDefinedConstructorName` is
  `getVerifiedOwnName(getDefinedConstructor(value, options))` — the constructor is
  resolved once and its `name` read from that resolved constructor via the generic
  `getVerifiedOwnName` (the own `name` descriptor's value, narrowed to a string primitive;
  own-only, with `getVerifiedNextAvailableName` reserved as the future chain-walking
  seam). The former `constructorRegistry` / `constructorNameRegistry` `WeakMap`s were
  removed: a benchmark showed they lost on the dominant distinct-object path and won only
  on caller-owned repeated detection. Within a single cross-realm call the once-resolved
  constructor is THREADED into the structural helpers (feeding both the name marker and
  the reciprocal-identity compare) rather than cached across calls — restoring the
  "memoization is the consumer's concern" ruling. This completes the registry-unwind begun
  for `prototypeRegistry` (#057) and retires the `(value, assumePrototype)` keying and
  poisoning fix of #054/#055 along with the caches.
- **Throw-safety (decisions #056, #059).** `getDefinedConstructor`'s two descriptor reads
  route through `getNextAvailableSafeDescriptor`, and `getVerifiedOwnName`'s own `name`
  read is wrapped, so a hostile trap (or a nullish input) yields `undefined` ("no
  reachable constructor" / "no verified name") rather than propagating. This applies the
  same #029 trust boundary the inert probes use, making every constructor-walk consumer
  (`#thenable`, `#object`, `#function`, `#primitive`, `#evented`) throw-safe; #059 extends
  it to the name read, closing the former raw `getOwnPropertyDescriptor` name read. The
  earlier "honest throw" stance is retracted — `undefined` is the contract-consistent
  answer, and no consumer relied on the throw.

## Raw/throw-safe pairing and layered throw-safety

The module's reads come in matched pairs — a raw form and a throw-safe twin over the same
operation: `getNextAvailablePropertyDescriptor` ↔ `getNextAvailableSafeDescriptor`, and
`getOwnPropertyNames` / `getOwnPropertySymbols` / `getOwnPropertyKeys` ↔ their `getSafe…`
counterparts. The raw form is for call sites that supply their own guarding (e.g.
`getValidatedStandardConstructorAndPrototypeTuple`, which wraps its own walk in
`try/catch`); the throw-safe form is the default the domain predicates compose. A reader
learns the shape once and it recurs across the module.

Throw-safety is deliberately layered, not doubled. `getNextAvailablePropertyDescriptor`
steps the chain through the throw-safe `getSafePrototypeOf` (which absorbs a hostile
`getPrototypeOf` trap), while `getNextAvailableSafeDescriptor` wraps the whole walk
(absorbing a hostile `getOwnPropertyDescriptor` trap). Two guards cover two distinct throw
sources, so the constructor-walk nesting them is defense-in-depth, not redundancy
(decisions #029, #056).

## Base-layer watch-list

Observations from the 2026-07-05 base-layer audit (`config` + `utility`) — each accepted
as-is, recorded so they need not be re-derived. None is a work item.

- **`doesNotShadow{X}Contract` allocates the value's full own-name array on the hot
  local-realm path** — `getOwnPropertyNames(value).some(isValueOfBoundSet, denylist)` in
  `#thenable` / `#evented`. Inverting to probe only the fixed denylist
  (`denylist.some((name) => objectHasOwn(value, name))`) would be allocation-free and
  O(denylist), but a genuine direct instance owns ZERO contract keys, so the array is
  already tiny and #063 deliberately made the callback closure-free (`isValueOfBoundSet`).
  Real but low-value; revisit only under a profiler.
- **The `TRUSTED_DATA_CONFIRMATION` flag trades signature width for a hot-path skip** of
  `isValidPropertyKey`. It threads a third positional argument through the descriptor-walk
  and every inert probe; the win is real, the cost is call-site legibility. First
  candidate if the machinery ever needs to simplify.
- **`getValidatedStandardConstructorAndPrototypeTuple` reads `prototype.constructor`
  directly** — the one property read that bypasses the inert-descriptor discipline.
  Justified: it runs once at module-load against the real intrinsic, inside the surrogate
  `try/catch`, so a hostile accessor collapses to the surrogate rather than propagating.

Verdict: the machinery earns its complexity and the perf levers that mattered are already
pulled (#057 no prototype-cache; #059 resolve-once threading). See also the "don't
factory-generate `isAlienRealm{X}`" rationale — explicit duplication here is
inline-cache-friendly and more readable than a factory over four near-identical seams.

## Open architectural questions

**Should a descriptor-aware sibling of `canOwnPropertyBeShaped` exist?** (Raised
2026-08-20; the question that prompted it was resolved 2026-08-21 by ADR #094, this
remainder is open but unmotivated.) Restating the contract as "can this slot take an
arbitrary shape" made the predicate exact, so the original framing — that it was
conservative and needed narrowing — dissolved. A caller who wants to know whether one
SPECIFIC weaker descriptor would apply still cannot ask: that needs the intended
descriptor as a parameter plus the `ValidateAndApplyPropertyDescriptor` compatibility
rules, which is a different function with a different name. No consumer wants it today,
and both packages still to come (`type-identity`, `custom-domain`) are sealing packages
that ask the arbitrary-shape question. Left unbuilt deliberately, not overlooked.

A second, smaller question rides along: `defineStableTypeIdentity` recomputes
`configurable !== false` inline for `name` and `Symbol.toStringTag` rather than calling
this predicate, so the two carry the same reasoning in two places — and the inline copy
lacks the extensibility arm.

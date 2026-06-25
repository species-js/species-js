# type-detection / utility

## Mental model

The utility module hosts cross-realm-safe primitives that feed the domain-specific
predicates: descriptor walks (`getNextAvailablePropertyDescriptor` and its throw-safe
wrapper `getInertDescriptor`), inert method and accessor probes (`hasInertMethod`,
`hasInertGetter`, `hasInertSetter`, `hasInertValue`), tag and type-signature readers
(`getTypeSignature`, `getTaggedType`), the inert constructor walk (`getDefinedConstructor`
and `getDefinedConstructorName` — decisions #047, #054–#059) plus the generic
verified-name reader (`getVerifiedOwnName`), and the user-facing type-name resolver
(`resolveType`).

The discipline is uniform: every property read is descriptor-based, accessor invocation is
deliberately avoided, and — since decision #056 — the descriptor-walk reads are
throw-safe: a hostile `getOwnPropertyDescriptor` / `getPrototypeOf` Proxy-trap yields the
"couldn't-determine" sentinel (`undefined` / `false`) rather than propagating, so a
type-guard always answers. The helpers compose into the predicates the type-domain modules
export. The module sits below every domain in the dependency graph and carries no
domain-specific knowledge of its own.

## Type Resolution

`resolveType` is the single public composer of the constructor-name and the tagged-type
signals. It codifies a two-axis dispatch rule.

**Axis 1 — PascalCase-leading constructor name wins outright.** Checked via the
module-local `startsWithUpperCase = /^\p{Lu}/u` regex. Every built-in and every
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
  `getDefinedConstructorName`; its `assumePrototype` call sites are
  `hasPlainObjectPrototypeContract` (`@/object`) and the thenable cross-realm
  prototype-equivalence check (`isStructuralPromisePrototypeEquivalent`).
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
  route through `getInertDescriptor`, and `getVerifiedOwnName`'s own `name` read is
  wrapped, so a hostile trap (or a nullish input) yields `undefined` ("no reachable
  constructor" / "no verified name") rather than propagating. This applies the same #029
  trust boundary the inert probes use, making every constructor-walk consumer
  (`@/thenable`, `@/object`, `@/function`, `@/primitive`, `@/evented`) throw-safe; #059
  extends it to the name read, closing the former raw `getOwnPropertyDescriptor` name
  read. The earlier "honest throw" stance is retracted — `undefined` is the
  contract-consistent answer, and no consumer relied on the throw.

## Open architectural questions

_Section currently empty — the utility module's public surface is complete pending the
test round._

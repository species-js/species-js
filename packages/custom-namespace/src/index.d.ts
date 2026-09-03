/**
 * @module @species-js/custom-namespace
 *
 * Frozen, prototype-less namespace objects — a module's exports grouped behind
 * one named, identifiable value.
 *
 * {@link createCustomNamespace} takes a name and a bag of exports and returns a
 * {@link CustomNamespace}: a null-prototype object whose members are resolved
 * once and frozen, branded with a non-enumerable `Symbol.toStringTag` of
 * `'CustomNamespace'` and a `Symbol.toPrimitive` that renders it as
 * `"[namespace '<name>']"`. It is closest in spirit to an ECMAScript module
 * namespace, and deliberately so — non-extensible, its members neither writable
 * nor configurable, and its brand absent from any copy of it.
 *
 * Members may be whatever the author exports; nothing restricts them to
 * functions. The single property a member keeps from its source is
 * `enumerable`.
 */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * A null-prototype object that serves as a custom namespace, similar to
 * an ECMAScript `Module`-type namespace. Its intended usage is to serve
 * as a named, identifiable entry-point for cross-realm type-detection.
 *
 * Created by {@link createCustomNamespace}, it carries a `Symbol.toStringTag`
 * of `'CustomNamespace'` and a `Symbol.toPrimitive` that returns
 * `"[namespace '<name>']"` for every hint the engine supplies — `'string'`,
 * `'number'` and `'default'` alike — so `String(ns)`, `` `${ns}` `` and
 * `ns + ''` all agree. The namespace has no numeric meaning, so `+ns` is `NaN`.
 *
 * Its members are a snapshot taken when it was built. Each is a frozen data
 * property — non-writable and non-configurable, so it can be neither
 * reassigned, redefined nor deleted — and the object itself is frozen, so
 * nothing can be attached either. Each keeps the `enumerable` flag its source
 * declared; symbol-keyed members are included on the same terms.
 *
 * Reading a member is therefore a plain value read. It never re-enters the
 * object the namespace was built from, never varies between reads, and never
 * throws.
 *
 * The two structural symbols are non-enumerable, so `{ ...namespace }` and
 * `Object.assign({}, namespace)` copy the contents without the identity — the
 * result is an ordinary object, not something that answers
 * `[object CustomNamespace]`.
 */
export interface CustomNamespace {
  readonly [Symbol.toStringTag]: 'CustomNamespace';
  readonly [Symbol.toPrimitive]: (hint: string) => string | undefined;
  readonly [key: PropertyKey]: unknown;
}

/**
 * Creates a null-prototype object, a custom namespace branded with
 * the provided name.
 *
 * The returned object has:
 * - Every own member of `exports` resolved once to a frozen value, keeping the
 *   `enumerable` flag its source declared
 * - `Symbol.toStringTag` set to `'CustomNamespace'`, non-enumerable
 * - `Symbol.toPrimitive` returning `"[namespace '<name>']"` for every hint the
 *   engine supplies, non-enumerable
 *
 * Members are RESOLVED, not copied. A data property contributes its value; an
 * accessor has its getter invoked once — here, during this call, with `exports`
 * as the receiver — and the result is stored. The namespace is therefore a
 * snapshot: later changes to `exports` never reach it, and reading a member can
 * never run source code. Building one is correspondingly **not**
 * side-effect-free, since every getter on `exports` runs exactly once.
 *
 * `enumerable` is the one flag a member keeps from its source, and the only
 * control the caller has over the result. Everything else is fixed by what a
 * namespace is: non-writable, non-configurable, resolved to a value. An object
 * literal makes every member enumerable, so the ordinary case needs no thought;
 * marking a member non-enumerable with `Object.defineProperty` is a deliberate
 * statement, and it is honored. Symbol-keyed members follow the same rule.
 *
 * Non-enumerable here means invisible to `Object.keys`, `for…in`,
 * `JSON.stringify`, spread and `Object.assign` — **not** private. Such a member
 * is still fully readable, and still listed by `Object.getOwnPropertyNames`,
 * `Object.getOwnPropertySymbols` and `Reflect.ownKeys`.
 *
 * The namespace's own `Symbol.toStringTag` and `Symbol.toPrimitive` are always
 * non-enumerable, as a real ES module namespace declares its `@@toStringTag`.
 * A copy therefore carries the contents and not the identity: `{ ...namespace }`
 * is a plain object that does not answer `[object CustomNamespace]`.
 *
 * A member with no readable value — a setter-only accessor, or one carrying
 * neither getter nor setter — is rejected, not skipped. Such a key could never
 * answer, and a namespace silently missing a member its author declared is the
 * outcome this builder exists to rule out.
 *
 * The namespace is frozen before it is returned, so it is non-extensible as
 * well: nothing can be attached to it afterward. `Object.isSealed` and
 * `Object.isFrozen` both report `true`. A real ES module namespace is
 * non-extensible for the same reason — the shape a detector inspects has to be
 * the shape the builder produced.
 *
 * `Symbol.toPrimitive` and `Symbol.toStringTag` are reserved: the namespace
 * defines both, and an `exports` carrying either is rejected rather than
 * silently overwritten.
 *
 * This is a builder, not a predicate. It either returns a complete namespace or
 * throws — `exports` is read through unguarded forms and its getters run
 * unprotected, so a source that cannot be enumerated, described or read fails
 * the call instead of producing a namespace that looks whole and is not.
 * `exports` is expected to be the author's own module surface at definition
 * time.
 *
 * `exports` is required and must carry at least one own property. An object
 * literal qualifies, so does a prototype-less `Object.create(null)` bag, and so
 * does a benign `Proxy` over either; an array, a function, a class instance and
 * every primitive do not. An already-built namespace does not qualify either —
 * a namespace is a terminal artifact, not raw material for another one.
 *
 * ## Rejection order
 *
 * Fixed, and part of the contract — the first blocker wins, so one mistake
 * always reports the same way. Four whole-argument checks run in argument
 * order, before anything is read:
 *
 * 1. `name` is not a string
 * 2. `exports` is neither a plain object nor a prototype-less dictionary
 * 3. `exports` has no own property
 * 4. `exports` carries a reserved key
 *
 * Per-member failures come after those, while resolving, in own-key order — a
 * member with no readable value, a descriptor that cannot be read, or a getter
 * that throws.
 *
 * The returned type is `CustomNamespace & Readonly<T>`, so a member keeps the
 * type it had on `exports` instead of collapsing to `unknown`. `T` is
 * constrained to `object` rather than to an index-signature type, because an
 * `interface` — the idiomatic way to declare a module's surface — carries no
 * implicit index signature and would otherwise be rejected outright. The
 * narrower shape rules are enforced at runtime, not in the type.
 *
 * One deliberate divergence between the type and the runtime:
 * `CustomNamespace`'s open index signature means an unknown key reads as
 * `unknown` rather than erroring, which is what keeps the type usable as a
 * parameter for any namespace.
 *
 * @param name - The namespace name. A non-string is rejected rather than
 *  coerced; one that trims to empty is accepted and yields `"[namespace '']"`.
 * @param exports - The exports to resolve onto the namespace. At least one own
 *  property is required, and every one of them must resolve to a value, so the
 *  namespace can never come back empty.
 * @returns The created namespace object, with its member types preserved.
 * @throws {TypeError} when `name` is not a string
 * @throws {TypeError} when `exports` is neither a plain object nor a
 *  prototype-less dictionary
 * @throws {TypeError} when `exports` has no own property
 * @throws {TypeError} when `exports` carries `Symbol.toPrimitive` or
 *  `Symbol.toStringTag`
 * @throws {TypeError} when an `exports` member has no readable value — a
 *  setter-only accessor, or one carrying neither getter nor setter
 * @throws {unknown} at a malicious `ownKeys` or `getOwnPropertyDescriptor`
 *  proxy-trap on `exports`, or from any `exports` getter invoked while resolving
 */
export function createCustomNamespace<T extends object>(
  name: string,
  exports: T,
): CustomNamespace & Readonly<T>;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

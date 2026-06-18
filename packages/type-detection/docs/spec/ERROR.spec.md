# error — behavioral specification

> Spec format and the multi-axis model are defined in [`./README.md`](./README.md).
> Vectors are reasoned from the canon (`error.d.ts`, `error.js`, `architecture/error.md`,
> decisions #032, #033, #035, #036). Status: **FROZEN 2026-06-18** — decidability check
> passed (5 suites over both public predicates + the 3 exported helpers, via the
> `@/index.js` barrel; Node 22 lacks native `Error.isError`, so the polyfill path ran and
> the native-vs-polyfill divergence (`isError/G1`) is asserted runtime-agnostically as
> `isError(graft) === (typeof Error.isError !== 'function')`). No spec corrections needed.
> Base for the axis-1 suite; axes 2–4 derive alongside.

## Module contract

`type-detection / error` discriminates the spec-defined error set and refines it to the
abort-channel naming convention. Unlike the thenable/evented type-narrowing lattices, this
module is a **five-tier composition stack**:

```
hasErrorPrototypeContract  (@internal) — descriptor-walk sub-helper (prototype shape)
  └ doesMatchErrorContract (@internal) — structural fallback dispatcher (tag branches)
     └ isGenericError      (@internal) — the polyfill body (instanceof + structural)
        └ isError          (public)    — native `Error.isError` if present, else the polyfill
           └ isAbortError  (public)    — name-suffix refinement
```

The pivotal fact: ECMA-262 `Error.isError` reads the unobservable `[[ErrorData]]` internal
slot, so the **polyfill widens** to a structural heuristic (tag + prototype-walk).
`isError` binds to native `Error.isError` when the runtime provides it (ES2025+ / Node
23+) and to `isGenericError` otherwise. The two agree on well-behaved values and **diverge
only on the legacy-widening cases** (`Object.create(Error.prototype)`, ES3-style errors).
See decisions #032 (native-or-polyfill), #033 (polyfill widening), #035 (`AbortError`
suffix).

## Surface inventory

**Public predicates (axis 1):** `isError` (an `export const` — native-or-polyfill bound at
module-load; typed as a function in the `.d.ts`), `isAbortError`.

**Exported `@internal` helpers (axis 4):** `hasErrorPrototypeContract`,
`doesMatchErrorContract`, `isGenericError` (the polyfill body, exported for testing and
for callers wanting polyfill semantics irrespective of runtime).

**Exported types without a predicate:** `GenericError` (`DOMException | Error`),
`AbortErrorName` (`` `${string}AbortError` ``), `AbortError`, and the `@internal`
`ErrorConstructorES2025` interface.

Re-confirmation gate: every `.js` runtime export has a `.d.ts` declaration (`isError` is
`const` in `.js` / `function` in `.d.ts` — the codified runtime-selected-binding dialect
delta, not a gap). **One drift fixed during drafting** — see Resolved items #1.

## Cross-cutting vectors

- **CC/nullish** — `null`, `undefined`, omitted → rejected by every predicate (each guards
  with `!!value` or the parameter-default-to-`null` pattern).
- **CC/non-error-object** — `{}`, `{ name: 'Error', message: '' }` → rejected (no
  `[[ErrorData]]`, prototype is `Object.prototype`).

## The native-vs-polyfill divergence (read before the `isError` vectors)

`isError`'s behavior on the **legacy-widening cases** depends on which implementation is
bound:

| input                                                                        | `isGenericError` (polyfill, deterministic) | native `Error.isError` | public `isError`  |
| ---------------------------------------------------------------------------- | ------------------------------------------ | ---------------------- | ----------------- |
| `new Error()`, `TypeError`, `DOMException`, `class X extends Error` instance | true                                       | true                   | **true (both)**   |
| `Object.create(Error.prototype)` / ES3-style                                 | true (widens)                              | false (no slot)        | **runtime-gated** |
| plain object, nullish                                                        | false                                      | false                  | **false (both)**  |

So the widening cases are specified under **`isGenericError`** (deterministic). For public
`isError`, the decidability run asserts the runtime-gated case as
`isError(graft) === (typeof Error.isError !== 'function')`.

---

## `isError` (public)

`isError<T = unknown>(value?: T): value is T & GenericError` Composition:
`const isError = isFunction(nativeIsError) ? nativeIsError : isGenericError`.

**Admits (both native and polyfill)**

- `isError/A1` — `new Error('boom')`, `new TypeError('x')`, `new RangeError()` → true.
- `isError/A2` — `new DOMException('msg', 'XError')` → true (`DOMException` carries
  `[[ErrorData]]`; native → true, polyfill → `'[object DOMException]'` tag).
- `isError/A3` — `new (class MyError extends Error {})()` → true (subclass instance
  carries `[[ErrorData]]`).
- `isError/A4` — a cross-realm `Error` (fixture) → true (`[[ErrorData]]` is
  realm-independent; polyfill `'[object Error]'` tag).

**Rejects (both)**

- `isError/R1` — `{ name: 'Error', message: '' }` → false (no slot; prototype
  `Object.prototype`).
- `isError/R2` — `42`, `'Error'`, `null`, `undefined`, `{}` → false.

**Runtime-gated (the divergence)**

- `isError/G1` — `Object.create(Error.prototype)` → **true under the polyfill, false under
  native** (`isError(graft) === (typeof Error.isError !== 'function')`). The polyfill
  behavior is pinned deterministically by `isGenericError/A4`.

**Refuses to claim**

- `isError/B1` — the `[[ErrorData]]` slot directly (unobservable). Native reads it; the
  polyfill approximates it structurally — hence the divergence.

**Cross-realm (axis 2):** admit foreign-realm `Error`/subclasses (both paths).
**Composition note (axis 4):** binds `nativeIsError` (captured) or `isGenericError`.

---

## `isAbortError` (public)

`isAbortError<T = unknown>(value?: T): value is T & AbortError` Composition:
`isError(value) && isStringValue(value.name) && value.name.endsWith('AbortError')`.

**Admits**

- `isAbortError/A1` — `new DOMException('aborted', 'AbortError')` → true (`isError` true
  under both paths; name suffix matches).
- `isAbortError/A2` — `new (class TimeoutAbortError extends Error {})()` with
  `name = 'TimeoutAbortError'` → true (qualified prefix; suffix matches).
- `isAbortError/A3` — `Object.assign(new Error(), { name: 'AbortError' })` → true (own
  `name` override on a real Error).

**Rejects**

- `isAbortError/R1` — `new Error('plain')` (name `'Error'`) → false (no suffix).
- `isAbortError/R2` — `{ name: 'AbortError' }` → false (not an Error — `isError` gate
  fails).
- `isAbortError/R3` — **the load-bearing `isStringValue` gate:**
  `Object.defineProperty(new Error(), 'name', { value: 42 })` → false (passes `isError`,
  but `name` is not a string; the gate prevents `42.endsWith` from throwing).
- `isAbortError/R4` — `null`, `undefined`, `{}` → false.

**Refuses to claim**

- `isAbortError/B1` — abort-channel _mechanics_ (no `AbortSignal.aborted` /
  `AbortController` inspection — that is the evented module's job). Purely a `name`-suffix
  check.

**Composition note (axis 4):** drives `isError` + `isStringValue` (`@/primitive`).

---

## Helper specification (axis 4)

### `isGenericError(value?)` — `@internal` (the polyfill body; deterministic)

`!!value && (value instanceof Error || doesMatchErrorContract(value))`.

- `isGenericError/A1` — `new Error()`, `new TypeError()` → true (instanceof arm).
- `isGenericError/A2` — `new DOMException('m', 'X')` → true (not `instanceof Error` in
  Node; structural `'[object DOMException]'` tag).
- `isGenericError/A3` — `new (class extends Error {})()` → true (instanceof).
- `isGenericError/A4` — `Object.create(Error.prototype)` → **true** (the widening;
  instanceof Error holds via the proto chain). Pins `isError/G1`'s polyfill side.
- `isGenericError/R1` — `{ name: 'Error', message: '' }`, `{}` → false (not instanceof;
  tag `'[object Object]'`, prototype walk fails).
- `isGenericError/R2` — `null`, `undefined`, `42` → false.

### `doesMatchErrorContract(value?)` — `@internal` (structural dispatcher)

`!!sig && (sig === '[object Error]' || sig === '[object DOMException]' || (sig === '[object Object]' && hasErrorPrototypeContract(value)))`.

- `dMEC/A1` — `new Error()`, `new TypeError()` → true (`'[object Error]'` tag).
- `dMEC/A2` — `new DOMException('m', 'X')` → true (`'[object DOMException]'` tag).
- `dMEC/A3` — `Object.create(Error.prototype)` → true (`'[object Object]'` + prototype
  walk).
- `dMEC/R1` — `{}`, `{ name: 'Error' }` → false (`'[object Object]'` tag, prototype
  `Object.prototype` fails the walk).
- `dMEC/R2` — `null`, `undefined` → false (`value && …` short-circuit).

### `hasErrorPrototypeContract(value?)` — `@internal` (prototype-shape sub-helper)

Inspects `getPrototypeOf(value)`: four own descriptors (`message`/`name` string-valued,
`constructor`/`toString` callable) + a trailing-`'Error'` `toString()` marker, OR a
recursive `isError(prototype)` fallback.

- `hEPC/A1` — `new Error()` → true (prototype `Error.prototype` satisfies the four-marker
  first arm).
- `hEPC/A2` — `Object.create(Error.prototype)` → true (same prototype).
- `hEPC/A3` — `Object.create(new Error('x'))` → true (first arm fails on the instance's
  own descriptors; recursion `isError(prototype)` holds — the prototype is a real `Error`
  with `[[ErrorData]]`, true under both native and polyfill).
- `hEPC/R1` — `{}` → false (prototype `Object.prototype`; first arm fails, recursion
  `isError(Object.prototype)` false).
- `hEPC/R2` — `null`, `undefined` → false (parameter-default-to-`null` guard / no
  prototype).

---

## Resolved items

1. **Architecture-doc drift (doc↔impl) — RESOLVED.** `architecture/error.md` referenced an
   `@internal` interface `ErrorConstructorWithIsError` (table row + the native-or-polyfill
   prose), but `error.d.ts` declares only `ErrorConstructorES2025` — the
   `ErrorConstructorWithIsError` type was removed from the surface during the doc round.
   The architecture doc was updated to drop the dead references (and its type/interface
   counts corrected). The decision-log mention (ADR #032) is left intact as append-only
   history. A `doc↔impl` drift the re-confirmation gate surfaced, now closed.

No open items.

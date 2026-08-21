/**
 * @module @species-js/type-detection
 *
 * The published surface — every export the package documents as part of its
 * contract, named one by one.
 *
 * Curation is the point. `src/index.js` re-exports each subdomain with a star
 * and so carries the package's `@internal` machinery too; it stays that way
 * because `#index` is what the test suite imports. This file is what
 * `package.json`'s `exports["."]` resolves to, so a consumer reaches only what
 * is listed below.
 *
 * The tag is not the boundary. `@internal` is documentation that no resolver
 * reads — this list is the enforcement, and `scripts/check-public-surface.mjs`
 * fails the build when the two disagree.
 *
 * The `#function` block stays FIRST. Re-export order is load-bearing through
 * the `function ↔ utility` eval-time cycle under vite's transform (ADR #083);
 * entering the cluster through any other member fires a capture against a
 * binding still in its temporal dead zone.
 */

export {
  getFunctionSource,
  hasConstructSlot,
  isAnyGeneratorFunction,
  isAsyncFunction,
  isAsyncGeneratorFunction,
  isBuiltInClass,
  isCallable,
  isClass,
  isCustomClass,
  isES3Function,
  isFunction,
  isGeneratorFunction,
  isNewableFunction,
} from '#function';
export type {
  AnyGeneratorFunction,
  AsyncFunction,
  AsyncGenerator,
  AsyncGeneratorFunction,
  Callable,
  CallableOrNewable,
  ClassConstructor,
  ES3Function,
  Generator,
  GeneratorFunction,
  NewableFunction,
  VerifiedFunction,
} from '#function';

export {
  objectCreate,
  objectHasOwn,
  defaultDataDescriptor,
  defaultDataAccessor,
  defaultEntryDescriptor,
  defaultEntryAccessor,
  readOnlyDataDescriptor,
  readOnlyEntryDescriptor,
  frozenDataDescriptor,
  frozenEntryDescriptor,
  sealedDataAccessor,
  sealedEntryAccessor,
} from '#config';
export type {
  BlankDictionary,
  BlankType,
  DefaultDataDescriptorOptions,
  DefaultDataAccessorOptions,
  DefaultEntryDescriptorOptions,
  DefaultEntryAccessorOptions,
  ReadOnlyDataDescriptorOptions,
  ReadOnlyEntryDescriptorOptions,
  FrozenDataDescriptorOptions,
  FrozenEntryDescriptorOptions,
  SealedDataAccessorOptions,
  SealedEntryAccessorOptions,
} from '#config';

export {
  canOwnPropertyBeShaped,
  getDefinedConstructor,
  getDefinedConstructorName,
  getNextAvailablePropertyDescriptor,
  getNextAvailableSafeDescriptor,
  getOwnPropertyKeys,
  getSafeOwnPropertyKeys,
  getSafeOwnPropertyNames,
  getSafeOwnPropertySymbols,
  getSafePrototypeOf,
  getTaggedType,
  getTypeSignature,
  getVerifiedOwnName,
  hasInertGetter,
  hasInertMethod,
  hasInertSetter,
  hasInertValue,
  hasOwnNonWritablePrototype,
  hasOwnPrototype,
  hasOwnWritablePrototype,
  isValidPropertyKey,
  isValidWeakKey,
  resolveType,
} from '#utility';
export type {
  ConstructorName,
  DefinedConstructorAccessorOptions,
  PredicateFunction,
  PropertyDescriptor,
  PropertyDescriptorMap,
  ResolvedType,
  TaggedType,
  TypeSignature,
  WeakKey,
} from '#utility';

export {
  isBigInt,
  isBigIntValue,
  isBoolean,
  isBooleanValue,
  isBoxablePrimitive,
  isBoxedBigInt,
  isBoxedBoolean,
  isBoxedNumber,
  isBoxedPrimitive,
  isBoxedString,
  isBoxedSymbol,
  isFiniteNumberValue,
  isIntegerValue,
  isNullishPrimitive,
  isNumber,
  isNumberValue,
  isPrimitiveValue,
  isRegisteredSymbol,
  isSafeIntegerValue,
  isString,
  isStringValue,
  isSymbol,
  isSymbolValue,
} from '#primitive';
export type {
  BigIntType,
  BigIntValue,
  BooleanType,
  BooleanValue,
  BoxablePrimitive,
  BoxedBigInt,
  BoxedBoolean,
  BoxedNumber,
  BoxedPrimitive,
  BoxedString,
  BoxedSymbol,
  NullishPrimitive,
  NumberType,
  NumberValue,
  PrimitiveValue,
  StringType,
  StringValue,
  SymbolType,
  SymbolValue,
} from '#primitive';

export {
  isDictionaryObject,
  isObject,
  isPlainObject,
  isPlainOrDictionaryObject,
} from '#object';
export type {
  AnyObject,
  DictionaryObject,
  PlainObject,
  PlainOrDictionaryObject,
} from '#object';

export { isAbortError, isDOMException, isError, isGenericError } from '#error';
export type {
  AbortError,
  AbortErrorName,
  AnyError,
  DOMException,
  DOMExceptionLegacyCodes,
} from '#error';

export {
  isAbortSignal,
  isAbortSignalLike,
  isEventTarget,
  isEventTargetLike,
} from '#evented';
export type { AbortSignalLike, EventTargetLike } from '#evented';

export { isPromise, isPromiseLike, isThenable } from '#thenable';
export type { AbortableThenable, PromiseLike, Thenable } from '#thenable';

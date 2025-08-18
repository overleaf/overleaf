export type Nullable<T> = T | null

// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type
interface DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> {}

type DeepReadonlyObject<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>
}

export type DeepReadonly<T> = T extends (infer R)[]
  ? DeepReadonlyArray<R>
  : T extends (...args: any[]) => void
    ? T
    : T extends object
      ? DeepReadonlyObject<T>
      : T

export type DeepPartial<T> = Partial<{ [P in keyof T]: DeepPartial<T[P]> }>

export type MergeAndOverride<Parent, Own> = Own & Omit<Parent, keyof Own>

export type Keys<T extends object> = (keyof T)[]

/**
 * Helper to create type guards for literal unions
 *
 * @example
 * ```ts
 * const fruit = ['apple', 'banana', 'cherry'] as const;
 * type Fruit = typeof fruit[number];
 * const isFruit = mkLiteralUnionTypeguard(fruit);
 *
 * // Usage example:
 * function eatFood(food: unknown[]) {
 *   food.forEach(item => {
 *     if (isFruit(item)) {
 *       eatFruit(item)
 *     } else {
 *       console.log(`Not fruit ${item}`)
 *     }
 *   })
 * }
 * eatFood(['banana', 'pizza'])
 * ```
 *
 * @param xs A readonly tuple of allowed values (strings, numbers, or symbols).
 * @returns A type guard function `(value: unknown) => value is T[number]`.
 */
export function mkLiteralUnionTypeguard<
  const T extends readonly (string | number | symbol)[],
>(xs: T) {
  return (v: unknown): v is T[number] =>
    (xs as readonly (string | number | symbol)[]).includes(v as any)
}

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

export type Entries<T extends object> = [keyof T, T[keyof T]][]

export type Keys<T extends object> = (keyof T)[]

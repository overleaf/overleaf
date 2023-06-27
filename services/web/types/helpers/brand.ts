declare const brand: unique symbol

export type Brand<T, TBrand> = T & { [brand]: TBrand }

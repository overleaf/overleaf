import { CSSProperties } from 'react'

export type CSSPropertiesWithVariables = CSSProperties &
  Record<`--${string}`, number | string>

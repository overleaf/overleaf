import { Nullable } from '../utils'

type Docs = Record<string, unknown>

interface Range {
  fromV: Nullable<unknown>
  toV: Nullable<unknown>
}

interface HoveredRange {
  fromV: Nullable<unknown>
  toV: Nullable<unknown>
}

export interface Selection {
  docs: Docs
  pathname: Nullable<string>
  range: Range
  hoveredRange: HoveredRange
  diff: Nullable<unknown>
  files: unknown[]
  file: Nullable<unknown>
}

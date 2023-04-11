import { FileDiff } from '../../frontend/js/features/history/services/types/file'
import { Nullable } from '../utils'

type Docs = Record<string, unknown>

interface Range {
  fromV: Nullable<number>
  toV: Nullable<number>
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
  files: FileDiff[]
  file: Nullable<unknown>
}

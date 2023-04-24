import { Meta } from './shared'

export interface DocDiffChunk {
  u?: string
  i?: string
  d?: string
  meta?: Meta
}

export interface BinaryDiffResponse {
  binary: true
}

export type DocDiffResponse = { diff: DocDiffChunk[] | BinaryDiffResponse }

interface Range {
  from: number
  to: number
}

export type HighlightType = 'addition' | 'deletion'

export interface Highlight {
  label: string
  hue: number
  range: Range
  type: HighlightType
}

export type Diff = {
  binary: boolean
  docDiff?: {
    doc: string
    highlights: Highlight[]
  }
}

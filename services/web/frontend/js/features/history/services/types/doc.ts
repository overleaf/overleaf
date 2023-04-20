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

export interface Highlight {
  label: string
  hue: number
  range: Range
  type: 'addition' | 'deletion'
}

export type Diff = {
  binary: boolean
  docDiff?: {
    doc: string
    highlights: Highlight[]
  }
}

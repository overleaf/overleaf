import React from 'react'

export type LogEntry = {
  raw: string
  level: ErrorLevel
  key: string
  file?: string
  column?: number
  line?: number
  ruleId?: string
  message?: string
  content?: string
  type?: string
  messageComponent?: React.ReactNode
  contentDetails?: string[]
}

export type ErrorLevel =
  | 'error'
  | 'warning'
  | 'info'
  | 'typesetting'
  | 'raw'
  | 'success'

export type SourceLocation = {
  file?: string
  // `line should be either a number or null (i.e. not required), but currently sometimes we get
  // an empty string (from BibTeX errors).
  line?: number | string | null
  column?: number
}

export type PdfFileData = { path: string; url: string }
type PdfFileArchiveData = { path: string; url: string; fileCount: number }

export type PdfFileDataList = {
  top: PdfFileData[]
  other: PdfFileData[]
  archive?: PdfFileArchiveData
}

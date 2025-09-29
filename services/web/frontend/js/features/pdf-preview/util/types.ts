import React from 'react'
import { CompileOutputFile } from '../../../../../types/compile'

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
  command?: string
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

export type PdfFileData = CompileOutputFile
type PdfFileArchiveData = CompileOutputFile & { fileCount: number }

export type PdfFileDataList = {
  top: PdfFileData[]
  other: PdfFileData[]
  archive?: PdfFileArchiveData
}

export type HighlightData = {
  page: number
  h: number
  v: number
  width: number
  height: number
}

export type DeliveryLatencies = {
  compileTimeClientE2E?: number
  compileTimeServerE2E?: number
  totalDeliveryTime?: number
  latencyFetch?: number
  latencyRender?: number
}

export type PdfCachingMetrics = {
  viewerId: string
}

export type PdfCachingMetricsFull = PdfCachingMetrics & {
  failedCount: number
  failedOnce: boolean
  tooMuchBandwidthCount: number
  tooManyRequestsCount: number
  cachedCount: number
  cachedBytes: number
  fetchedCount: number
  fetchedBytes: number
  latencyComputeMax: number
  latencyComputeTotal: number
  requestedCount: number
  requestedBytes: number
  oldUrlHitCount: number
  oldUrlMissCount: number
  enablePdfCaching: boolean
  prefetchingEnabled: boolean
  prefetchLargeEnabled: boolean
  cachedUrlLookupEnabled: boolean
  chunkVerifySizeDiffers?: number
  chunkVerifyMismatch?: number
  chunkVerifySuccess?: number
  headerVerifyFailure?: number
}

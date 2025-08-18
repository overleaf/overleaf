export type PDFRange = {
  objectId: Uint8Array
  end: number
  hash: string
  size: number
  start: number
  totalUsage: number
}

type OutputFileBase = {
  path: string
  url: string
  type: string
  build: string
  downloadURL: string

  // assigned by buildFileList in frontend
  main?: boolean
}

export type PDFFile = OutputFileBase & {
  clsiCacheShard: string
  contentId: string
  createdAt: Date
  editorId: string
  pdfDownloadURL: string
  pdfURL: string
  prefetched: any[]
  preprocessed: boolean
  ranges: PDFRange[]
  size: number
}

export type CompileOutputFile = OutputFileBase | PDFFile

export type CompileResponseData = {
  fromCache?: boolean
  status: string
  outputFiles: CompileOutputFile[]
  compileGroup?: string
  clsiServerId?: string
  clsiCacheShard?: string
  pdfDownloadDomain?: string
  pdfCachingMinChunkSize: number
  validationProblems: any
  stats: any
  timings: any
  outputFilesArchive?: CompileOutputFile

  // assigned on response body by DocumentCompiler in frontend
  rootDocId?: string | null
  options: CompileOptions
}

export type CompileOptions = {
  draft?: boolean
  stopOnFirstError?: boolean
  isAutoCompileOnLoad?: boolean
  isAutoCompileOnChange?: boolean
  rootResourcePath?: string
  imageName?: string
  compiler?: string
}

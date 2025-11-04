export type Chunk = {
  start: number
  end: number
}

export type PrefetchedChunk<ChunkType extends Chunk> = ChunkType & {
  buffer: Uint8Array
}

export type PDFRange<ObjectIdType = Uint8Array | string> = Chunk & {
  objectId: ObjectIdType
  hash: string
  size: number
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

type PDFFileBase = OutputFileBase & {
  clsiCacheShard: string
  contentId: string
  editorId: string
  pdfDownloadUrl: string
  pdfUrl: string
  size: number
  startXRefTable?: number
}

export type PDFFile = PDFFileBase & {
  createdAt?: string
  ranges: PDFRange<string>[]
  prefetched?: PrefetchedChunk<PDFRange<Uint8Array>>[]
}

export type ProcessedPDFFile = PDFFileBase & {
  preprocessed: true
  createdAt: Date
  prefetched: PrefetchedChunk<PDFRange<Uint8Array>>[]
  ranges: PDFRange<Uint8Array>[]
}

// This type is a little bit of a hack to work around the fact that we mutate
// the PDFFile object directly when processed into a ProcessedPDFFile
export type PartiallyProcessedPDFFile = PDFFileBase & {
  preprocessed?: boolean
  createdAt?: Date | string
  prefetched?: PrefetchedChunk<PDFRange<Uint8Array>>[]
  ranges: PDFRange<Uint8Array>[] | PDFRange<string>[]
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
  stats?: Record<string, number>
  timings?: Record<string, number>
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

export type CompileOutputFile = {
  path: string
  url: string
  downloadURL?: string
  type: string
  build: string
  ranges?: {
    start: number
    end: number
    hash: string
    objectId: string
  }[]
  contentId?: string
  size?: number

  // assigned by buildFileList in frontend
  main?: boolean
}

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

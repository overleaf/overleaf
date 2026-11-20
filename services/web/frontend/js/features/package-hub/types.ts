export type PackageSource = 'texlive' | 'ctan' | 'custom' | 'community'

export type PackageItem = {
  id: string
  name: string
  source: PackageSource
  category?: string
  version: string
  installed_version?: string | null
  installed: boolean
  update_available: boolean
  protected?: boolean
  shortdesc?: string
  description: string
  longdesc?: string
  license?: string
  author?: string
  homepage?: string
  ctanPath?: string
  topics?: string[]
  size_kb?: number
  dependencies?: string[]
  runfiles?: string[]
  uploaded_by?: string | null
  uploaded_by_email?: string
  created_at?: string
  updated_at?: string
  manifest?: CommunityManifest
}

export type PackagesListResponse = {
  items: PackageItem[]
  total: number
  page: number
  limit: number
  totalPages: number
  counts: {
    all: number
    installed: number
    available: number
    updates: number
    custom: number
    community: number
  }
}

export type JobStatus = 'queued' | 'running' | 'success' | 'failed'

export type JobItem = {
  id: string
  jobId: string
  type:
    | 'install'
    | 'remove'
    | 'update'
    | 'upload'
    | 'community-install'
    | 'snapshot'
    | 'reconcile'
  payload?: Record<string, any>
  status: JobStatus
  progress: number
  phase: string
  message: string
  log: string[]
  error?: string | null
  result?: any
  created_by: string
  created_by_email?: string
  created_at: string
  started_at?: string | null
  finished_at?: string | null
}

export type JobStreamEvent = {
  jobId: string
  type?: string
  status: JobStatus
  phase: string
  message: string
  percent: number
  logLine?: string | null
  log?: string[]
  error?: string | null
  result?: any
}

export type CommunityManifest = {
  id?: string
  name: string
  version: string
  description: string
  author: string
  url: string
  packages: string[]
  custom_files?: string[]
  last_synced_at?: string
  installedCount?: number
  totalCount?: number
  allInstalled?: boolean
  packageStatuses?: Array<{
    name: string
    installed: boolean
    source: string
  }>
}

export type AuditEntry = {
  id?: string
  _id?: string
  user_id: string
  user_email?: string
  action: string
  package_name: string
  source?: string
  result: string
  details?: string
  timestamp: string
}

export type SourceHealth = {
  id: string
  name: string
  healthy: boolean
  mirrorUrl?: string
  endpoint?: string
  texmfDir?: string
  availableCount?: number
  installedCount?: number
  cachedCount?: number
  manifestCount?: number
}

export type PackageHubConfig = {
  canMutate: boolean
  canUpload: boolean
  isAdmin: boolean
}

export type UploadValidationResult = {
  ok: boolean
  valid: boolean
  packageName: string
  detectedType: string
  entryFile?: string | null
  sizeKb: number
  files: string[]
  compileTest: {
    passed: boolean
    log: string
  }
}

export type FullHistoryFailure = {
  category?: string
} & ProjectHistoryFailureRecordSchema

export type ProjectHistoryFailureRecordSchema = {
  _id: string
  project_id: string
  attempts: number
  resyncAttempts: number
  resyncStartedAt: string
  requestCount?: number
  history: ProjectHistoryFailureEntrySchema[]
} & ProjectHistoryFailureEntrySchema

export type ProjectHistoryFailureEntrySchema =
  | SyncStartRecordSchema
  | ErrorRecordSchema

export type ErrorRecordSchema = {
  error: string
  stack: string
  queueSize: number
  ts: string
}

export type SyncStartRecordSchema = {
  resyncStartedAt: string
}

export type SyncStateSchema = {
  resyncProjectStructure: boolean
  resyncDocContents: string[]
  origin?: { kind: string }
}

export type SyncStateHistoryEntry = {
  syncState: SyncStateSchema
  timestamp: string
}

export type HistoryDebugInfoResponse = {
  failureRecord?: ProjectHistoryFailureRecordSchema
  syncState: SyncStateSchema & {
    resyncPending: boolean
    resyncCount: number
    resyncPendingSince?: string
    lastUpdated: string
    history: SyncStateHistoryEntry[]
  }
}

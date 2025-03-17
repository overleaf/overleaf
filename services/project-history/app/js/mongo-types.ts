import { ObjectId } from 'mongodb-legacy'

export type ProjectHistoryFailure = {
  _id: ObjectId
  project_id: string
  attempts: number
  resyncAttempts: number
  resyncStartedAt: Date
  requestCount?: number
  history: (ErrorRecord | SyncStartRecord)[]
} & ErrorRecord

type ErrorRecord = {
  error: string
  stack: string
  queueSize: number
  ts: Date
}

type SyncStartRecord = {
  resyncStartedAt: Date
}

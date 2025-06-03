import EventEmitter from 'events'
import { StringFileData } from 'overleaf-editor-core'

// type for the Doc class in vendor/libs/sharejs.js
export interface ShareLatexOTShareDoc extends EventEmitter {
  otType: 'sharejs-text-ot'
  snapshot: string
  detach_cm6?: () => void
  getText: () => string
  insert: (pos: number, insert: string, fromUndo: boolean) => void
  del: (pos: number, length: number, fromUndo: boolean) => void
  submitOp(op: any[]): void
}

export interface HistoryOTShareDoc extends EventEmitter {
  otType: 'history-ot'
  snapshot: StringFileData
  detach_cm6?: () => void
  getText: () => string
  submitOp(op: any[]): void
}

export type ShareDoc = ShareLatexOTShareDoc | HistoryOTShareDoc

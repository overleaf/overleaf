import { StringFileData } from 'overleaf-editor-core'
import { AnyOperation } from '../../../../../../types/change'
import { RawEditOperation } from 'overleaf-editor-core/lib/types'

export type Version = number

export type ShareJsConnectionState = 'ok' | 'disconnected' | 'stopped'

export type ShareJsOperation = AnyOperation[]

export type TrackChangesIdSeeds = { inflight: string; pending: string }

export interface ShareJsTextType<Snapshot = any, Operation = any> {
  transformX(op1: Operation, op2: Operation): Operation[]
  apply(snapshot: Snapshot, op: Operation): Snapshot
  compose(op1: Operation, op2: Operation): Operation

  api: {
    insert(pos: number, text: string, fromUndo: boolean): void
    del(pos: number, length: number, fromUndo: boolean): void
    getText(): string
    getLength(): number
    _register(): void
  }

  // stub-interface, provided by sharejs.Doc
  submitOp(op: Operation): void
}

// TODO: check the properties of this type
export type Message = {
  v: Version
  open?: boolean
  meta?: {
    type?: string
  }
  doc?: string
  snapshot?: string | StringFileData
  type?: ShareJsTextType
  op?: AnyOperation[] | RawEditOperation[]
}

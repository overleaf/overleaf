import { AnyOperation } from '../../../../../../types/change'

export type Version = number

export type ShareJsConnectionState = 'ok' | 'disconnected' | 'stopped'

export type ShareJsOperation = AnyOperation[]

export type TrackChangesIdSeeds = { inflight: string; pending: string }

// TODO: check the properties of this type
export type Message = {
  v: Version
  open?: boolean
  meta?: {
    type?: string
  }
  doc?: string
  snapshot?: string
}

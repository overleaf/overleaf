import { AnyOperation } from '../../../../../../types/change'

export type Version = number

export type ShareJsConnectionState = 'ok' | 'disconnected' | 'stopped'

export type ShareJsOperation = AnyOperation[]

export type TrackChangesIdSeeds = { inflight: string; pending: string }

export type Message = Record<string, any>
// TODO: MIGRATION: Make an accurate and more specific type
// {
//   v: Version
//   open?: boolean
//   meta?: {
//     type: string
//   }
//   doc?: string
//   snapshot?: string
// }

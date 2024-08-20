import { Nullable } from '../../../../../../types/utils'

export interface User {
  first_name: string
  last_name: string
  email: string
  id: string
}

export interface Meta {
  users: Nullable<User>[]
  start_ts: number
  end_ts: number
  type?: 'external' // TODO
  source?: 'git-bridge' // TODO
  origin?:
    | {
        kind:
          | 'dropbox'
          | 'upload'
          | 'git-bridge'
          | 'github'
          | 'history-resync'
          | 'history-migration'
      }
    | {
        kind: 'file-restore'
        path: string
        timestamp: number
        version: number
      }
    | {
        kind: 'project-restore'
        timestamp: number
        version: number
      }
}

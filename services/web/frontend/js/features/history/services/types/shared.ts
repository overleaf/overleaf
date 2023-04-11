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
  origin?: {
    kind:
      | 'dropbox'
      | 'upload'
      | 'git-bridge'
      | 'github'
      | 'history-resync'
      | 'history-migration'
  }
}

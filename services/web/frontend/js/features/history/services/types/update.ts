import { Meta, User } from './shared'
import { Label } from './label'
import { Nullable } from '../../../../../../types/utils'

export type Version = number

export interface ProjectOp {
  add?: { pathname: string }
  rename?: { pathname: string; newPathname: string }
  remove?: { pathname: string }
  atV: Version
}

export interface UpdateRange {
  fromV: Version
  toV: Version
  fromVTimestamp: number
  toVTimestamp: number
}

export interface Update {
  fromV: Version
  toV: Version
  meta: Meta
  labels: Label[]
  pathnames: string[]
  project_ops: ProjectOp[]
}

export interface LoadedUpdateMetaUser extends User {
  hue?: number
}

export type LoadedUpdateMetaUsers = Nullable<LoadedUpdateMetaUser>[]

interface LoadedUpdateMeta extends Meta {
  first_in_day?: true
  users: LoadedUpdateMetaUsers
}

export interface LoadedUpdate extends Update {
  meta: LoadedUpdateMeta
}

export type FetchUpdatesResponse = {
  updates: Update[]
  nextBeforeTimestamp?: number
}

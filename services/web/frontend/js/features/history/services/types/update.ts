import { Meta, User } from './shared'
import { Label } from './label'
import { Nullable } from '../../../../../../types/utils'

export interface ProjectOp {
  add?: { pathname: string }
  rename?: { pathname: string; newPathname: string }
  remove?: { pathname: string }
  atV: number
}

export interface Update {
  fromV: number
  toV: number
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

export interface UpdateSelection {
  update: Update
  comparing: boolean
}

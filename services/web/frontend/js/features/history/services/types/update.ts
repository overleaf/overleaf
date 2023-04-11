import { Meta, User } from './shared'
import { Nullable } from '../../../../../../types/utils'

interface UpdateLabel {
  id: string
  comment: string
  version: number
  user_id: string
  created_at: string
}

export interface Label extends UpdateLabel {
  user_display_name: string
}

export interface PseudoCurrentStateLabel {
  id: '1'
  isPseudoCurrentStateLabel: true
  version: Nullable<number>
  created_at: string
}

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

interface LoadedUpdateMetaUser extends User {
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

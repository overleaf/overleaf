import { Meta } from './shared'

interface UpdateLabel {
  id: string
  comment: string
  version: number
  user_id: string
  created_at: string
}

interface Label extends UpdateLabel {
  user_display_name: string
}

interface ProjectOp {
  add?: { pathname: string }
  rename?: { pathname: string; newPathname: string }
  remove?: { pathname: string }
  atV: number
}

export interface Update {
  fromV: number
  toV: number
  meta: Meta
  labels?: Label[]
  pathnames: string[]
  project_ops: ProjectOp[]
}

export interface UpdateSelection {
  update: Update
  comparing: boolean
}

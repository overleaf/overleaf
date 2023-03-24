interface User {
  first_name: string
  last_name: string
  email: string
  id: string
}

interface UpdateMeta {
  users: User[]
  start_ts: number
  end_ts: number
}

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
  meta: UpdateMeta
  labels?: Label[]
  pathnames: string[]
  project_ops: ProjectOp[]
}

export interface UpdateSelection {
  update: Update
  comparing: boolean
}

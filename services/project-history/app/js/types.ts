export type Update = TextUpdate | AddDocUpdate | AddFileUpdate | RenameUpdate

export type UpdateMeta = {
  user_id: string
  ts: string
  source?: string
  type?: string
  origin?: RawOrigin
}

export type TextUpdate = {
  doc: string
  op: Op[]
  v: number
  meta: UpdateMeta & {
    pathname: string
    doc_length: number
  }
}

type ProjectUpdateBase = {
  version: string
  projectHistoryId: string
  meta: UpdateMeta
  doc: string
}

export type AddDocUpdate = ProjectUpdateBase & {
  pathname: string
  docLines: string[]
}

export type AddFileUpdate = ProjectUpdateBase & {
  pathname: string
  file: string
  url: string
}

export type RenameUpdate = ProjectUpdateBase & {
  pathname: string
  new_pathname: string
}

export type Op = InsertOp | DeleteOp | CommentOp

export type InsertOp = {
  i: string
  p: number
}

export type DeleteOp = {
  d: string
  p: number
}

export type CommentOp = {
  c: string
  p: number
  t: string
}

export type UpdateWithBlob = {
  update: Update
  blobHash: string
}

export type RawOrigin = {
  kind: string
}

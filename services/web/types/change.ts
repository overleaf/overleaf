export interface Operation {
  p: number
}

export interface InsertOperation extends Operation {
  i: string
  t: string
}

export interface ChangeOperation extends Operation {
  c: string
  t: string
}

export interface DeleteOperation extends Operation {
  d: string
}

export interface CommentOperation extends Operation {
  c: string
}

export type AnyOperation =
  | InsertOperation
  | ChangeOperation
  | DeleteOperation
  | CommentOperation

export type Change<T extends AnyOperation = AnyOperation> = {
  id: string
  metadata?: string
  op: T
}

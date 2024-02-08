import { ThreadId } from './review-panel/review-panel'
import { UserId } from './user'

export interface Operation {
  p: number // position
}

export interface InsertOperation extends Operation {
  i: string // inserted text
}

export interface DeleteOperation extends Operation {
  d: string // deleted text
}

export interface CommentOperation extends Operation {
  c: string // comment text
  t: ThreadId // thread/comment id
}

export type EditOperation = InsertOperation | DeleteOperation

export type AnyOperation = EditOperation | CommentOperation

export type Change<T extends AnyOperation = AnyOperation> = {
  id: string
  metadata?: {
    user_id: UserId | null
    ts: Date
  }
  op: T
}

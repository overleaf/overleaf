import { EditorFacade } from '../modules/source-editor/frontend/js/extensions/realtime'
import {
  AnyOperation,
  Change,
  ChangeOperation,
  CommentOperation,
  DeleteOperation,
  InsertOperation,
} from './change'

export type CurrentDoc = {
  doc_id: string
  docName: string
  track_changes_as: string | null
  ranges: {
    changes: Change<InsertOperation | ChangeOperation | DeleteOperation>[]
    comments: Change<CommentOperation>[]
    resolvedThreadIds: Record<string, any>
    removeCommentId: (id: string) => void
    removeChangeIds: (ids: string[]) => void
    getChanges: (
      ids: string[]
    ) => Change<InsertOperation | ChangeOperation | DeleteOperation>[]
    validate: (text: string) => void
  }
  attachToCM6: (editor: EditorFacade) => void
  detachFromCM6: () => void
  on: (eventName: string, listener: EventListener) => void
  off: (eventName: string) => void
  submitOp: (op: AnyOperation) => void
  getSnapshot: () => string
}

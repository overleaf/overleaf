import EventEmitter from '../frontend/js/utils/EventEmitter'
import { ShareDoc } from './share-doc'
import { EditorFacade } from '../frontend/js/features/source-editor/extensions/realtime'
import {
  AnyOperation,
  Change,
  ChangeOperation,
  CommentOperation,
  DeleteOperation,
  InsertOperation,
} from './change'

// type for the Document class in ide/editor/Document.js
// note: this is a custom EventEmitter class
export interface CurrentDoc extends EventEmitter {
  doc_id: string
  docName: string
  doc: ShareDoc | null
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
  submitOp: (op: AnyOperation) => void
  getSnapshot: () => string
}

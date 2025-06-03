import {
  EditOperationBuilder,
  EditOperationTransformer,
  InsertOp,
  RemoveOp,
  RetainOp,
  StringFileData,
  TextOperation,
} from 'overleaf-editor-core'
import { RawEditOperation } from 'overleaf-editor-core/lib/types'
import { ShareDoc } from '../../../../../types/share-doc'

type Api = {
  otType: 'history-ot'
  trackChangesUserId: string | null

  getText(): string
  getLength(): number
  _register(): void
}

const api: Api & ThisType<Api & ShareDoc & { snapshot: StringFileData }> = {
  otType: 'history-ot',
  trackChangesUserId: null,

  getText() {
    return this.snapshot.getContent()
  },

  getLength() {
    return this.snapshot.getStringLength()
  },

  _register() {
    this.on(
      'remoteop',
      (rawEditOperation: RawEditOperation[], oldSnapshot: StringFileData) => {
        const operation = EditOperationBuilder.fromJSON(rawEditOperation[0])
        if (operation instanceof TextOperation) {
          const str = oldSnapshot.getContent()
          if (str.length !== operation.baseLength)
            throw new TextOperation.ApplyError(
              "The operation's base length must be equal to the string's length.",
              operation,
              str
            )

          let outputCursor = 0
          let inputCursor = 0
          let trackedChangesInvalidated = false
          for (const op of operation.ops) {
            if (op instanceof RetainOp) {
              inputCursor += op.length
              outputCursor += op.length
              if (op.tracking != null) {
                trackedChangesInvalidated = true
              }
            } else if (op instanceof InsertOp) {
              this.emit(
                'insert',
                outputCursor,
                op.insertion,
                op.insertion.length
              )
              outputCursor += op.insertion.length
              trackedChangesInvalidated = true
            } else if (op instanceof RemoveOp) {
              this.emit(
                'delete',
                outputCursor,
                str.slice(inputCursor, inputCursor + op.length)
              )
              inputCursor += op.length
              trackedChangesInvalidated = true
            }
          }

          if (inputCursor !== str.length) {
            throw new TextOperation.ApplyError(
              "The operation didn't operate on the whole string.",
              operation,
              str
            )
          }

          if (trackedChangesInvalidated) {
            this.emit('tracked-changes-invalidated')
          }
        }
      }
    )
  },
}

export const historyOTType = {
  api,

  transformX(raw1: RawEditOperation[], raw2: RawEditOperation[]) {
    const [a, b] = EditOperationTransformer.transform(
      EditOperationBuilder.fromJSON(raw1[0]),
      EditOperationBuilder.fromJSON(raw2[0])
    )
    return [[a.toJSON()], [b.toJSON()]]
  },

  apply(snapshot: StringFileData, rawEditOperation: RawEditOperation[]) {
    const operation = EditOperationBuilder.fromJSON(rawEditOperation[0])
    const afterFile = StringFileData.fromRaw(snapshot.toRaw())
    afterFile.edit(operation)
    return afterFile
  },

  compose(op1: RawEditOperation[], op2: RawEditOperation[]) {
    return [
      EditOperationBuilder.fromJSON(op1[0])
        .compose(EditOperationBuilder.fromJSON(op2[0]))
        .toJSON(),
    ]
  },

  // Do not provide normalize, used by submitOp to fixup bad input.
  // normalize(op: TextOperation) {}

  // Do not provide invert, only needed for reverting a rejected update.
  // We are displaying an out-of-sync modal when an op is rejected.
  // invert(op: TextOperation) {}
}

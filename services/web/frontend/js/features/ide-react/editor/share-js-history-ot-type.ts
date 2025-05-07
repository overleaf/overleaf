import EventEmitter from '@/utils/EventEmitter'
import {
  EditOperationBuilder,
  InsertOp,
  RemoveOp,
  RetainOp,
  StringFileData,
  TextOperation,
} from 'overleaf-editor-core'
import { RawEditOperation } from 'overleaf-editor-core/lib/types'

function loadTextOperation(raw: RawEditOperation): TextOperation {
  const operation = EditOperationBuilder.fromJSON(raw)
  if (!(operation instanceof TextOperation)) {
    throw new Error(`operation not supported: ${operation.constructor.name}`)
  }
  return operation
}

export class HistoryOTType extends EventEmitter {
  // stub interface, these are actually on the Doc
  api: HistoryOTType
  snapshot: StringFileData

  constructor(snapshot: StringFileData) {
    super()
    this.api = this
    this.snapshot = snapshot
  }

  transformX(raw1: RawEditOperation[], raw2: RawEditOperation[]) {
    const [a, b] = TextOperation.transform(
      loadTextOperation(raw1[0]),
      loadTextOperation(raw2[0])
    )
    return [[a.toJSON()], [b.toJSON()]]
  }

  apply(snapshot: StringFileData, rawEditOperation: RawEditOperation[]) {
    const operation = loadTextOperation(rawEditOperation[0])
    const afterFile = StringFileData.fromRaw(snapshot.toRaw())
    afterFile.edit(operation)
    this.snapshot = afterFile
    return afterFile
  }

  compose(op1: RawEditOperation[], op2: RawEditOperation[]) {
    return [
      loadTextOperation(op1[0]).compose(loadTextOperation(op2[0])).toJSON(),
    ]
  }

  // Do not provide normalize, used by submitOp to fixup bad input.
  // normalize(op: TextOperation) {}

  // Do not provide invert, only needed for reverting a rejected update.
  // We are displaying an out-of-sync modal when an op is rejected.
  // invert(op: TextOperation) {}

  // API
  insert(pos: number, text: string, fromUndo: boolean) {
    const old = this.getText()
    const op = new TextOperation()
    op.retain(pos)
    op.insert(text)
    op.retain(old.length - pos)
    this.submitOp([op.toJSON()])
  }

  del(pos: number, length: number, fromUndo: boolean) {
    const old = this.getText()
    const op = new TextOperation()
    op.retain(pos)
    op.remove(length)
    op.retain(old.length - pos - length)
    this.submitOp([op.toJSON()])
  }

  getText() {
    return this.snapshot.getContent({ filterTrackedDeletes: true })
  }

  getLength() {
    return this.getText().length
  }

  _register() {
    this.on(
      'remoteop',
      (rawEditOperation: RawEditOperation[], oldSnapshot: StringFileData) => {
        const operation = loadTextOperation(rawEditOperation[0])
        const str = oldSnapshot.getContent()
        if (str.length !== operation.baseLength)
          throw new TextOperation.ApplyError(
            "The operation's base length must be equal to the string's length.",
            operation,
            str
          )

        let outputCursor = 0
        let inputCursor = 0
        for (const op of operation.ops) {
          if (op instanceof RetainOp) {
            inputCursor += op.length
            outputCursor += op.length
          } else if (op instanceof InsertOp) {
            this.emit('insert', outputCursor, op.insertion, op.insertion.length)
            outputCursor += op.insertion.length
          } else if (op instanceof RemoveOp) {
            this.emit(
              'delete',
              outputCursor,
              str.slice(inputCursor, inputCursor + op.length)
            )
            inputCursor += op.length
          }
        }

        if (inputCursor !== str.length)
          throw new TextOperation.ApplyError(
            "The operation didn't operate on the whole string.",
            operation,
            str
          )
      }
    )
  }

  // stub-interface, provided by sharejs.Doc
  submitOp(op: RawEditOperation[]) {}
}

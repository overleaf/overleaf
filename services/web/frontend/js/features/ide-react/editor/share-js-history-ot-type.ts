import {
  EditOperation,
  EditOperationTransformer,
  StringFileData,
} from 'overleaf-editor-core'
import { ShareDoc } from '../../../../../types/share-doc'

type Api = {
  otType: 'history-ot'
  trackChangesUserId: string | null

  getText(): string
  getLength(): number
}

const api: Api & ThisType<Api & ShareDoc & { snapshot: StringFileData }> = {
  otType: 'history-ot',
  trackChangesUserId: null,

  getText() {
    return this.snapshot.getContent({ filterTrackedDeletes: true })
  },

  getLength() {
    return this.snapshot.getStringLength()
  },
}

export const historyOTType = {
  api,

  transformX(ops1: EditOperation[], ops2: EditOperation[]) {
    // Dynamic programming algorithm: gradually transform both sides in a nested
    // loop.
    const left = [...ops1]
    const right = [...ops2]
    for (let i = 0; i < left.length; i++) {
      for (let j = 0; j < right.length; j++) {
        // At this point:
        // left[0..i] is ops1[0..i] rebased over ops2[0..j-1]
        // right[0..j] is ops2[0..j] rebased over ops1[0..i-1]
        const [a, b] = EditOperationTransformer.transform(left[i], right[j])
        left[i] = a
        right[j] = b
      }
    }
    return [left, right]
  },

  apply(snapshot: StringFileData, ops: EditOperation[]) {
    const afterFile = StringFileData.fromRaw(snapshot.toRaw())
    for (const op of ops) {
      afterFile.edit(op)
    }
    return afterFile
  },

  compose(ops1: EditOperation[], ops2: EditOperation[]) {
    const ops = [...ops1, ...ops2]
    let currentOp = ops.shift()
    if (currentOp === undefined) {
      // No ops to process
      return []
    }
    const result = []
    for (const op of ops) {
      if (currentOp.canBeComposedWith(op)) {
        currentOp = currentOp.compose(op)
      } else {
        result.push(currentOp)
        currentOp = op
      }
    }
    result.push(currentOp)
    return result
  },

  // Do not provide normalize, used by submitOp to fixup bad input.
  // normalize(op: TextOperation) {}

  // Do not provide invert, only needed for reverting a rejected update.
  // We are displaying an out-of-sync modal when an op is rejected.
  // invert(op: TextOperation) {}
}

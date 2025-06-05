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
    const [a, b] = EditOperationTransformer.transform(ops1[0], ops2[0])
    return [[a], [b]]
  },

  apply(snapshot: StringFileData, ops: EditOperation[]) {
    const afterFile = StringFileData.fromRaw(snapshot.toRaw())
    afterFile.edit(ops[0])
    return afterFile
  },

  compose(ops1: EditOperation[], ops2: EditOperation[]) {
    return [ops1[0].compose(ops2[0])]
  },

  // Do not provide normalize, used by submitOp to fixup bad input.
  // normalize(op: TextOperation) {}

  // Do not provide invert, only needed for reverting a rejected update.
  // We are displaying an out-of-sync modal when an op is rejected.
  // invert(op: TextOperation) {}
}

const DMP = require('diff-match-patch')
const { TextOperation } = require('overleaf-editor-core')
const dmp = new DMP()

// Do not attempt to produce a diff for more than 100ms
dmp.Diff_Timeout = 0.1

module.exports = {
  ADDED: 1,
  REMOVED: -1,
  UNCHANGED: 0,

  diffAsShareJsOp(before, after) {
    const diffs = dmp.diff_main(before.join('\n'), after.join('\n'))
    dmp.diff_cleanupSemantic(diffs)

    const ops = []
    let position = 0
    for (const diff of diffs) {
      const [type, content] = diff
      if (type === this.ADDED) {
        ops.push({
          i: content,
          p: position,
        })
        position += content.length
      } else if (type === this.REMOVED) {
        ops.push({
          d: content,
          p: position,
        })
      } else if (type === this.UNCHANGED) {
        position += content.length
      } else {
        throw new Error('Unknown type')
      }
    }
    return ops
  },

  diffAsHistoryV1EditOperation(before, after) {
    const diffs = dmp.diff_main(before, after)
    dmp.diff_cleanupSemantic(diffs)

    const op = new TextOperation()
    for (const diff of diffs) {
      const [type, content] = diff
      if (type === this.ADDED) {
        op.insert(content)
      } else if (type === this.REMOVED) {
        op.remove(content.length)
      } else if (type === this.UNCHANGED) {
        op.retain(content.length)
      } else {
        throw new Error('Unknown type')
      }
    }
    return op
  },
}

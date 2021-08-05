const DMP = require('diff-match-patch')
const dmp = new DMP()

// Do not attempt to produce a diff for more than 100ms
dmp.Diff_Timeout = 0.1

module.exports = {
  ADDED: 1,
  REMOVED: -1,
  UNCHANGED: 0,

  diffAsShareJsOp(before, after, callback) {
    const diffs = dmp.diff_main(before.join('\n'), after.join('\n'))
    dmp.diff_cleanupSemantic(diffs)

    const ops = []
    let position = 0
    for (const diff of diffs) {
      const type = diff[0]
      const content = diff[1]
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
    callback(null, ops)
  },
}

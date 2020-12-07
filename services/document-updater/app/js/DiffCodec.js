/* eslint-disable
    camelcase,
    handle-callback-err,
    new-cap,
    no-throw-literal,
*/
const { diff_match_patch } = require('../lib/diff_match_patch')
const dmp = new diff_match_patch()

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
          p: position
        })
        position += content.length
      } else if (type === this.REMOVED) {
        ops.push({
          d: content,
          p: position
        })
      } else if (type === this.UNCHANGED) {
        position += content.length
      } else {
        throw 'Unknown type'
      }
    }
    callback(null, ops)
  }
}

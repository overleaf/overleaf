/* eslint-disable
    camelcase,
    handle-callback-err,
    new-cap,
    no-throw-literal,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let DiffCodec
const { diff_match_patch } = require('../lib/diff_match_patch')
const dmp = new diff_match_patch()

module.exports = DiffCodec = {
  ADDED: 1,
  REMOVED: -1,
  UNCHANGED: 0,

  diffAsShareJsOp(before, after, callback) {
    if (callback == null) {
      callback = function (error, ops) {}
    }
    const diffs = dmp.diff_main(before.join('\n'), after.join('\n'))
    dmp.diff_cleanupSemantic(diffs)

    const ops = []
    let position = 0
    for (const diff of Array.from(diffs)) {
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
    return callback(null, ops)
  }
}

const OError = require('@overleaf/o-error')
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

  /**
   * @param {import("overleaf-editor-core").StringFileData} file
   * @param {string} after
   * @return {TextOperation}
   */
  diffAsHistoryOTEditOperation(file, after) {
    const beforeWithoutTrackedDeletes = file.getContent({
      filterTrackedDeletes: true,
    })
    const diffs = dmp.diff_main(beforeWithoutTrackedDeletes, after)
    dmp.diff_cleanupSemantic(diffs)

    const trackedChanges = file.trackedChanges.asSorted()
    let nextTc = trackedChanges.shift()

    const op = new TextOperation()
    for (const diff of diffs) {
      let [type, content] = diff
      if (type === this.ADDED) {
        op.insert(content)
      } else if (type === this.REMOVED || type === this.UNCHANGED) {
        while (op.baseLength + content.length > nextTc?.range.start) {
          if (nextTc.tracking.type === 'delete') {
            const untilRange = nextTc.range.start - op.baseLength
            if (type === this.REMOVED) {
              op.remove(untilRange)
            } else if (type === this.UNCHANGED) {
              op.retain(untilRange)
            }
            op.retain(nextTc.range.end - nextTc.range.start)
            content = content.slice(untilRange)
          }
          nextTc = trackedChanges.shift()
        }
        if (type === this.REMOVED) {
          op.remove(content.length)
        } else if (type === this.UNCHANGED) {
          op.retain(content.length)
        }
      } else {
        throw new Error('Unknown type')
      }
    }
    while (nextTc) {
      if (
        nextTc.tracking.type !== 'delete' ||
        nextTc.range.start !== op.baseLength
      ) {
        throw new OError(
          'StringFileData.trackedChanges out of sync: unexpected range after end of diff',
          { nextTc, baseLength: op.baseLength }
        )
      }
      op.retain(nextTc.range.end - nextTc.range.start)
      nextTc = trackedChanges.shift()
    }
    return op
  },
}

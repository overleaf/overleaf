/* eslint-disable
    no-proto,
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
let DiffGenerator
function ConsistencyError(message) {
  const error = new Error(message)
  error.name = 'ConsistencyError'
  error.__proto__ = ConsistencyError.prototype
  return error
}
ConsistencyError.prototype.__proto__ = Error.prototype

const logger = require('@overleaf/logger')

module.exports = DiffGenerator = {
  ConsistencyError,

  rewindUpdate(content, update) {
    for (let j = update.op.length - 1, i = j; j >= 0; j--, i = j) {
      const op = update.op[i]
      if (op.broken !== true) {
        try {
          content = DiffGenerator.rewindOp(content, op)
        } catch (e) {
          if (e instanceof ConsistencyError && (i = update.op.length - 1)) {
            // catch known case where the last op in an array has been
            // merged into a later op
            logger.warn(
              { err: e, update, op: JSON.stringify(op) },
              'marking op as broken'
            )
            op.broken = true
          } else {
            throw e // rethrow the execption
          }
        }
      }
    }
    return content
  },

  rewindOp(content, op) {
    let p
    if (op.i != null) {
      // ShareJS will accept an op where p > content.length when applied,
      // and it applies as though p == content.length. However, the op is
      // passed to us with the original p > content.length. Detect if that
      // is the case with this op, and shift p back appropriately to match
      // ShareJS if so.
      ;({ p } = op)
      const maxP = content.length - op.i.length
      if (p > maxP) {
        logger.warn({ maxP, p }, 'truncating position to content length')
        p = maxP
        op.p = p // fix out of range offsets to avoid invalid history exports in ZipManager
      }

      const textToBeRemoved = content.slice(p, p + op.i.length)
      if (op.i !== textToBeRemoved) {
        throw new ConsistencyError(
          `Inserted content, '${op.i}', does not match text to be removed, '${textToBeRemoved}'`
        )
      }

      return content.slice(0, p) + content.slice(p + op.i.length)
    } else if (op.d != null) {
      if (op.p > content.length) {
        op.p = content.length // fix out of range offsets to avoid invalid history exports in ZipManager
      }
      return content.slice(0, op.p) + op.d + content.slice(op.p)
    } else {
      return content
    }
  },

  rewindUpdates(content, updates) {
    for (const update of Array.from(updates.reverse())) {
      try {
        content = DiffGenerator.rewindUpdate(content, update)
      } catch (e) {
        e.attempted_update = update // keep a record of the attempted update
        throw e // rethrow the exception
      }
    }
    return content
  },

  buildDiff(initialContent, updates) {
    let diff = [{ u: initialContent }]
    for (const update of Array.from(updates)) {
      diff = DiffGenerator.applyUpdateToDiff(diff, update)
    }
    diff = DiffGenerator.compressDiff(diff)
    return diff
  },

  compressDiff(diff) {
    const newDiff = []
    for (const part of Array.from(diff)) {
      const lastPart = newDiff[newDiff.length - 1]
      if (
        lastPart != null &&
        (lastPart.meta != null ? lastPart.meta.user : undefined) != null &&
        (part.meta != null ? part.meta.user : undefined) != null
      ) {
        if (
          lastPart.i != null &&
          part.i != null &&
          lastPart.meta.user.id === part.meta.user.id
        ) {
          lastPart.i += part.i
          lastPart.meta.start_ts = Math.min(
            lastPart.meta.start_ts,
            part.meta.start_ts
          )
          lastPart.meta.end_ts = Math.max(
            lastPart.meta.end_ts,
            part.meta.end_ts
          )
        } else if (
          lastPart.d != null &&
          part.d != null &&
          lastPart.meta.user.id === part.meta.user.id
        ) {
          lastPart.d += part.d
          lastPart.meta.start_ts = Math.min(
            lastPart.meta.start_ts,
            part.meta.start_ts
          )
          lastPart.meta.end_ts = Math.max(
            lastPart.meta.end_ts,
            part.meta.end_ts
          )
        } else {
          newDiff.push(part)
        }
      } else {
        newDiff.push(part)
      }
    }
    return newDiff
  },

  applyOpToDiff(diff, op, meta) {
    let consumedDiff
    const position = 0

    let remainingDiff = diff.slice()
    ;({ consumedDiff, remainingDiff } = DiffGenerator._consumeToOffset(
      remainingDiff,
      op.p
    ))
    const newDiff = consumedDiff

    if (op.i != null) {
      newDiff.push({
        i: op.i,
        meta,
      })
    } else if (op.d != null) {
      ;({ consumedDiff, remainingDiff } =
        DiffGenerator._consumeDiffAffectedByDeleteOp(remainingDiff, op, meta))
      newDiff.push(...Array.from(consumedDiff || []))
    }

    newDiff.push(...Array.from(remainingDiff || []))

    return newDiff
  },

  applyUpdateToDiff(diff, update) {
    for (const op of Array.from(update.op)) {
      if (op.broken !== true) {
        diff = DiffGenerator.applyOpToDiff(diff, op, update.meta)
      }
    }
    return diff
  },

  _consumeToOffset(remainingDiff, totalOffset) {
    let part
    const consumedDiff = []
    let position = 0
    while ((part = remainingDiff.shift())) {
      const length = DiffGenerator._getLengthOfDiffPart(part)
      if (part.d != null) {
        consumedDiff.push(part)
      } else if (position + length >= totalOffset) {
        const partOffset = totalOffset - position
        if (partOffset > 0) {
          consumedDiff.push(DiffGenerator._slicePart(part, 0, partOffset))
        }
        if (partOffset < length) {
          remainingDiff.unshift(DiffGenerator._slicePart(part, partOffset))
        }
        break
      } else {
        position += length
        consumedDiff.push(part)
      }
    }

    return {
      consumedDiff,
      remainingDiff,
    }
  },

  _consumeDiffAffectedByDeleteOp(remainingDiff, deleteOp, meta) {
    const consumedDiff = []
    let remainingOp = deleteOp
    while (remainingOp && remainingDiff.length > 0) {
      let newPart
      ;({ newPart, remainingDiff, remainingOp } =
        DiffGenerator._consumeDeletedPart(remainingDiff, remainingOp, meta))
      if (newPart != null) {
        consumedDiff.push(newPart)
      }
    }
    return {
      consumedDiff,
      remainingDiff,
    }
  },

  _consumeDeletedPart(remainingDiff, op, meta) {
    let deletedContent, newPart, remainingOp
    const part = remainingDiff.shift()
    const partLength = DiffGenerator._getLengthOfDiffPart(part)

    if (part.d != null) {
      // Skip existing deletes
      remainingOp = op
      newPart = part
    } else if (partLength > op.d.length) {
      // Only the first bit of the part has been deleted
      const remainingPart = DiffGenerator._slicePart(part, op.d.length)
      remainingDiff.unshift(remainingPart)

      deletedContent = DiffGenerator._getContentOfPart(part).slice(
        0,
        op.d.length
      )
      if (deletedContent !== op.d) {
        throw new ConsistencyError(
          `deleted content, '${deletedContent}', does not match delete op, '${op.d}'`
        )
      }

      if (part.u != null) {
        newPart = {
          d: op.d,
          meta,
        }
      } else if (part.i != null) {
        newPart = null
      }

      remainingOp = null
    } else if (partLength === op.d.length) {
      // The entire part has been deleted, but it is the last part

      deletedContent = DiffGenerator._getContentOfPart(part)
      if (deletedContent !== op.d) {
        throw new ConsistencyError(
          `deleted content, '${deletedContent}', does not match delete op, '${op.d}'`
        )
      }

      if (part.u != null) {
        newPart = {
          d: op.d,
          meta,
        }
      } else if (part.i != null) {
        newPart = null
      }

      remainingOp = null
    } else if (partLength < op.d.length) {
      // The entire part has been deleted and there is more

      deletedContent = DiffGenerator._getContentOfPart(part)
      const opContent = op.d.slice(0, deletedContent.length)
      if (deletedContent !== opContent) {
        throw new ConsistencyError(
          `deleted content, '${deletedContent}', does not match delete op, '${opContent}'`
        )
      }

      if (part.u) {
        newPart = {
          d: part.u,
          meta,
        }
      } else if (part.i != null) {
        newPart = null
      }

      remainingOp = {
        p: op.p,
        d: op.d.slice(DiffGenerator._getLengthOfDiffPart(part)),
      }
    }

    return {
      newPart,
      remainingDiff,
      remainingOp,
    }
  },

  _slicePart(basePart, from, to) {
    let part
    if (basePart.u != null) {
      part = { u: basePart.u.slice(from, to) }
    } else if (basePart.i != null) {
      part = { i: basePart.i.slice(from, to) }
    }
    if (basePart.meta != null) {
      part.meta = basePart.meta
    }
    return part
  },

  _getLengthOfDiffPart(part) {
    return (part.u || part.d || part.i || '').length
  },

  _getContentOfPart(part) {
    return part.u || part.d || part.i || ''
  },
}

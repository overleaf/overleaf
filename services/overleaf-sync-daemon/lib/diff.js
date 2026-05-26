// Convert a "before" / "after" pair of strings into a sequence of ShareJS
// OT ops: [{i, p} | {d, p}, ...]. Positions are character offsets in the
// document state as ops are applied left-to-right.

const DiffMatchPatch = require('diff-match-patch')

const dmp = new DiffMatchPatch()
// Edit cost — leave at default; we re-cleanup with semantic + efficiency.

const DIFF_DELETE = -1
const DIFF_INSERT = 1
const DIFF_EQUAL = 0

function textToOps(before, after) {
  if (before === after) return []

  // Fast path for pure prepend / append / single-region edits — common when
  // Claude rewrites a function or a user types a few characters.
  const commonPrefix = sharedPrefix(before, after)
  const commonSuffix = sharedSuffix(
    before.slice(commonPrefix),
    after.slice(commonPrefix)
  )

  const beforeMid = before.slice(commonPrefix, before.length - commonSuffix)
  const afterMid = after.slice(commonPrefix, after.length - commonSuffix)

  const ops = []
  if (beforeMid.length === 0 && afterMid.length === 0) {
    return ops
  }
  if (beforeMid.length === 0) {
    ops.push({ i: afterMid, p: commonPrefix })
    return ops
  }
  if (afterMid.length === 0) {
    ops.push({ d: beforeMid, p: commonPrefix })
    return ops
  }

  // Single-contiguous edit — emit delete then insert at the same position.
  // For more complex multi-region edits, fall back to diff-match-patch.
  if (beforeMid.length + afterMid.length < 256) {
    ops.push({ d: beforeMid, p: commonPrefix })
    ops.push({ i: afterMid, p: commonPrefix })
    return ops
  }

  return diffMatchPatchToOps(before, after)
}

function diffMatchPatchToOps(before, after) {
  const diffs = dmp.diff_main(before, after)
  dmp.diff_cleanupEfficiency(diffs)

  const ops = []
  let pos = 0
  for (const [type, text] of diffs) {
    if (text.length === 0) continue
    if (type === DIFF_EQUAL) {
      pos += text.length
    } else if (type === DIFF_INSERT) {
      ops.push({ i: text, p: pos })
      pos += text.length
    } else if (type === DIFF_DELETE) {
      ops.push({ d: text, p: pos })
      // pos unchanged — deleted content is gone from the result so far.
    }
  }
  return ops
}

function sharedPrefix(a, b) {
  const max = Math.min(a.length, b.length)
  let i = 0
  while (i < max && a.charCodeAt(i) === b.charCodeAt(i)) i++
  return i
}

function sharedSuffix(a, b) {
  const max = Math.min(a.length, b.length)
  let i = 0
  while (
    i < max &&
    a.charCodeAt(a.length - 1 - i) === b.charCodeAt(b.length - 1 - i)
  ) {
    i++
  }
  return i
}

// Apply an OT op array to a string in-place. Used by the shadow state to
// stay in sync with whatever the server thinks the doc is.
function applyOps(text, ops) {
  let result = text
  for (const op of ops) {
    if (typeof op.i === 'string') {
      result = result.slice(0, op.p) + op.i + result.slice(op.p)
    } else if (typeof op.d === 'string') {
      const expected = result.slice(op.p, op.p + op.d.length)
      if (expected !== op.d) {
        throw new Error(
          `delete mismatch at p=${op.p}: expected ${JSON.stringify(
            op.d
          )}, found ${JSON.stringify(expected)}`
        )
      }
      result = result.slice(0, op.p) + result.slice(op.p + op.d.length)
    }
  }
  return result
}

module.exports = { textToOps, applyOps }

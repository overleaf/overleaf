// @ts-check
'use strict'

const DMP = require('diff-match-patch')
const OError = require('@overleaf/o-error')
const TextOperation = require('./operation/text_operation')
const TrackingProps = require('./file_data/tracking_props')

/**
 * @import StringFileData from './file_data/string_file_data'
 */

const ADDED = 1
const REMOVED = -1
const UNCHANGED = 0

const dmp = new DMP()

// Do not attempt to produce a diff for more than 100ms
dmp.Diff_Timeout = 0.1

/**
 * Diff the file's content against `after` and return a minimal TextOperation
 * turning the file into it. The diff is computed against the content with
 * tracked deletes filtered out (the content external sources see); the
 * returned operation preserves the file's tracked deletes.
 *
 * @param {StringFileData} file eagerly loaded file data
 * @param {string} after
 * @param {object} [opts]
 * @param {{userId: string, ts: Date}} [opts.tracking] record the edit as
 *        tracked changes
 * @return {TextOperation}
 */
function diffAsTextOperation(file, after, opts = {}) {
  const beforeWithoutTrackedDeletes = file.getContent({
    filterTrackedDeletes: true,
  })
  const diffs = dmp.diff_main(beforeWithoutTrackedDeletes, after)
  dmp.diff_cleanupSemantic(diffs)
  return diffsToTextOperation(file, diffs, opts)
}

/**
 * Convert diff-match-patch style diffs into a TextOperation.
 *
 * The diffs must have been computed against the file content with tracked
 * deletes filtered out, i.e. `file.getContent({ filterTrackedDeletes: true })`,
 * which is the content that external sources (uploads, github-sync, tpds) see.
 * The returned operation applies to the full content: positions are mapped to
 * step over tracked-delete spans with plain retains, preserving them.
 *
 * When `opts.tracking` is set, the edit is recorded as tracked changes:
 * insertions become tracked inserts and removals become tracked deletes,
 * except inside existing tracked inserts, where removals stay regular
 * deletes, and over existing tracked deletes, which are left untouched
 * (keeping the original author). This mirrors the semantics of updates with
 * track changes enabled in project-history's UpdateTranslator.
 *
 * Exported for tests: use diffAsTextOperation instead.
 *
 * @param {StringFileData} file eagerly loaded file data
 * @param {[number, string][]} diffs diff-match-patch diffs
 * @param {object} [opts]
 * @param {{userId: string, ts: Date}} [opts.tracking] record the edit as
 *        tracked changes
 * @return {TextOperation}
 */
function diffsToTextOperation(file, diffs, opts = {}) {
  const insertTracking = opts.tracking
    ? new TrackingProps('insert', opts.tracking.userId, opts.tracking.ts)
    : undefined
  const deleteTracking = opts.tracking
    ? new TrackingProps('delete', opts.tracking.userId, opts.tracking.ts)
    : undefined

  const trackedChanges = file.trackedChanges.asSorted()
  let tcIndex = 0

  const op = new TextOperation()

  /**
   * Consume removed content: a plain remove, or a tracked delete when
   * recording tracked changes.
   *
   * @param {number} length
   */
  function removeContent(length) {
    if (deleteTracking) {
      op.retain(length, { tracking: deleteTracking })
    } else {
      op.remove(length)
    }
  }

  for (const diff of diffs) {
    const type = diff[0]
    let content = diff[1]
    if (type === ADDED) {
      op.insert(content, insertTracking ? { tracking: insertTracking } : {})
      continue
    }
    if (type !== REMOVED && type !== UNCHANGED) {
      throw new Error('Unknown type')
    }

    while (tcIndex < trackedChanges.length) {
      const tc = trackedChanges[tcIndex]
      const segmentEnd = op.baseLength + content.length
      if (tc.range.start >= segmentEnd) break
      if (tc.tracking.type === 'delete') {
        // Tracked deletes are invisible in the diffed content. Step over
        // them with a plain retain, preserving the original tracked delete.
        const before = tc.range.start - op.baseLength
        if (type === REMOVED) {
          removeContent(before)
        } else {
          op.retain(before)
        }
        op.retain(tc.range.length)
        content = content.slice(before)
        tcIndex++
      } else if (type === REMOVED && deleteTracking) {
        // Removals inside existing tracked inserts are always regular
        // deletes, even when recording tracked changes.
        const before = Math.max(0, tc.range.start - op.baseLength)
        removeContent(before)
        const overlap = Math.min(tc.range.end, segmentEnd) - op.baseLength
        op.remove(overlap)
        content = content.slice(before + overlap)
        if (tc.range.end <= op.baseLength) {
          tcIndex++
        } else {
          // The tracked insert extends beyond this diff segment.
          break
        }
      } else {
        // Tracked inserts are ordinary visible content otherwise. Only move
        // past them once the whole range has been covered by diff segments.
        if (tc.range.end <= segmentEnd) {
          tcIndex++
        } else {
          break
        }
      }
    }

    if (type === REMOVED) {
      removeContent(content.length)
    } else {
      op.retain(content.length)
    }
  }

  // Any tracked deletes after the end of the diffed content must be retained.
  while (tcIndex < trackedChanges.length) {
    const tc = trackedChanges[tcIndex]
    if (tc.tracking.type !== 'delete' || tc.range.start !== op.baseLength) {
      throw new OError(
        'StringFileData.trackedChanges out of sync: unexpected range after end of diff',
        { nextTc: tc, baseLength: op.baseLength }
      )
    }
    op.retain(tc.range.length)
    tcIndex++
  }

  return op
}

module.exports = {
  diffAsTextOperation,
  diffsToTextOperation,
  ADDED,
  REMOVED,
  UNCHANGED,
}

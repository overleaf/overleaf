// @ts-check
const Range = require('../range')
const TrackedChange = require('./tracked_change')
const TrackingProps = require('../file_data/tracking_props')
const { InsertOp, RemoveOp, RetainOp } = require('../operation/scan_op')

/**
 * @import { TrackingDirective, TrackedChangeRawData } from "../types"
 * @import TextOperation from "../operation/text_operation"
 */

class TrackedChangeList {
  /**
   *
   * @param {TrackedChange[]} trackedChanges
   */
  constructor(trackedChanges) {
    /**
     * @type {TrackedChange[]}
     */
    this._trackedChanges = trackedChanges
  }

  /**
   * @returns {IterableIterator<TrackedChange>}
   */
  [Symbol.iterator]() {
    return this._trackedChanges.values()
  }

  /**
   *
   * @param {TrackedChangeRawData[]} raw
   * @returns {TrackedChangeList}
   */
  static fromRaw(raw) {
    return new TrackedChangeList(raw.map(TrackedChange.fromRaw))
  }

  /**
   * Converts the tracked changes to a raw object
   * @returns {TrackedChangeRawData[]}
   */
  toRaw() {
    return this._trackedChanges.map(change => change.toRaw())
  }

  get length() {
    return this._trackedChanges.length
  }

  /**
   * @returns {readonly TrackedChange[]}
   */
  asSorted() {
    // NOTE: Once all code dependent on this is typed, we can just return
    // _trackedChanges.
    return Array.from(this._trackedChanges)
  }

  /**
   * Returns the tracked changes that are fully included in the range
   * @param {Range} range
   * @returns {TrackedChange[]}
   */
  inRange(range) {
    return this._trackedChanges.filter(change => range.contains(change.range))
  }

  /**
   * Returns tracked changes that overlap with the given range
   * @param {Range} range
   * @returns {TrackedChange[]}
   */
  intersectRange(range) {
    const changes = []
    for (const change of this._trackedChanges) {
      const intersection = change.intersectRange(range)
      if (intersection != null) {
        changes.push(intersection)
      }
    }
    return changes
  }

  /**
   * Returns the tracking props for a given range.
   * @param {Range} range
   * @returns {TrackingProps | undefined}
   */
  propsAtRange(range) {
    return this._trackedChanges.find(change => change.range.contains(range))
      ?.tracking
  }

  /**
   * Removes the tracked changes that are fully included in the range
   * @param {Range} range
   */
  removeInRange(range) {
    this._trackedChanges = this._trackedChanges.filter(
      change => !range.contains(change.range)
    )
  }

  /**
   * Adds a tracked change to the list
   * @param {TrackedChange} trackedChange
   */
  add(trackedChange) {
    this._trackedChanges.push(trackedChange)
    this._mergeRanges()
  }

  /**
   * Collapses consecutive (and compatible) ranges
   *
   * @private
   * @returns {void}
   */
  _mergeRanges() {
    if (this._trackedChanges.length < 2) {
      return
    }
    // ranges are non-overlapping so we can sort based on their first indices
    this._trackedChanges.sort((a, b) => a.range.start - b.range.start)
    const newTrackedChanges = [this._trackedChanges[0]]
    for (let i = 1; i < this._trackedChanges.length; i++) {
      const last = newTrackedChanges[newTrackedChanges.length - 1]
      const current = this._trackedChanges[i]
      if (last.range.overlaps(current.range)) {
        throw new Error('Ranges cannot overlap')
      }
      if (current.range.isEmpty()) {
        throw new Error('Tracked changes range cannot be empty')
      }
      if (last.canMerge(current)) {
        newTrackedChanges[newTrackedChanges.length - 1] = last.merge(current)
      } else {
        newTrackedChanges.push(current)
      }
    }
    this._trackedChanges = newTrackedChanges
  }

  /**
   * Apply an insert operation
   *
   * @param {number} cursor
   * @param {string} insertedText
   * @param {{tracking?: TrackingProps}} opts
   */
  applyInsert(cursor, insertedText, opts = {}) {
    this._applyInsert(cursor, insertedText, opts)
    this._mergeRanges()
  }

  /**
   * Apply an insert operation
   *
   * This method will not merge ranges at the end
   *
   * @private
   * @param {number} cursor
   * @param {string} insertedText
   * @param {{tracking?: TrackingProps}} [opts]
   */
  _applyInsert(cursor, insertedText, opts = {}) {
    const newTrackedChanges = []
    for (const trackedChange of this._trackedChanges) {
      if (
        // If the cursor is before or at the insertion point, we need to move
        // the tracked change
        trackedChange.range.startIsAfter(cursor) ||
        cursor === trackedChange.range.start
      ) {
        newTrackedChanges.push(
          new TrackedChange(
            trackedChange.range.moveBy(insertedText.length),
            trackedChange.tracking
          )
        )
      } else if (cursor === trackedChange.range.end) {
        // The insertion is at the end of the tracked change. So we don't need
        // to move it.
        newTrackedChanges.push(trackedChange)
      } else if (trackedChange.range.containsCursor(cursor)) {
        // If the tracked change is in the inserted text, we need to expand it
        // split in three chunks. The middle one is added if it is a tracked insertion
        const [firstRange, , thirdRange] = trackedChange.range.insertAt(
          cursor,
          insertedText.length
        )
        const firstPart = new TrackedChange(firstRange, trackedChange.tracking)
        if (!firstPart.range.isEmpty()) {
          newTrackedChanges.push(firstPart)
        }
        // second part will be added at the end if it is a tracked insertion
        const thirdPart = new TrackedChange(thirdRange, trackedChange.tracking)
        if (!thirdPart.range.isEmpty()) {
          newTrackedChanges.push(thirdPart)
        }
      } else {
        newTrackedChanges.push(trackedChange)
      }
    }

    if (opts.tracking) {
      // This is a new tracked change
      const newTrackedChange = new TrackedChange(
        new Range(cursor, insertedText.length),
        opts.tracking
      )
      newTrackedChanges.push(newTrackedChange)
    }
    this._trackedChanges = newTrackedChanges
  }

  /**
   * Apply a delete operation to the list of tracked changes
   *
   * @param {number} cursor
   * @param {number} length
   */
  applyDelete(cursor, length) {
    this._applyDelete(cursor, length)
    this._mergeRanges()
  }

  /**
   * Apply a delete operation to the list of tracked changes
   *
   * This method will not merge ranges at the end
   *
   * @private
   * @param {number} cursor
   * @param {number} length
   */
  _applyDelete(cursor, length) {
    const newTrackedChanges = []
    for (const trackedChange of this._trackedChanges) {
      const deletedRange = new Range(cursor, length)
      // If the tracked change is after the deletion, we need to move it
      if (deletedRange.contains(trackedChange.range)) {
        continue
      } else if (deletedRange.overlaps(trackedChange.range)) {
        const newRange = trackedChange.range.subtract(deletedRange)
        if (!newRange.isEmpty()) {
          newTrackedChanges.push(
            new TrackedChange(newRange, trackedChange.tracking)
          )
        }
      } else if (trackedChange.range.startIsAfter(cursor)) {
        newTrackedChanges.push(
          new TrackedChange(
            trackedChange.range.moveBy(-length),
            trackedChange.tracking
          )
        )
      } else {
        newTrackedChanges.push(trackedChange)
      }
    }
    this._trackedChanges = newTrackedChanges
  }

  /**
   * Apply a retain operation to the list of tracked changes
   *
   * @param {number} cursor
   * @param {number} length
   * @param {{tracking?: TrackingDirective}} [opts]
   */
  applyRetain(cursor, length, opts = {}) {
    this._applyRetain(cursor, length, opts)
    this._mergeRanges()
  }

  /**
   * Apply a retain operation to the list of tracked changes
   *
   * This method will not merge ranges at the end
   *
   * @private
   * @param {number} cursor
   * @param {number} length
   * @param {{tracking?: TrackingDirective}} opts
   */
  _applyRetain(cursor, length, opts = {}) {
    // If there's no tracking info, leave everything as-is
    if (!opts.tracking) {
      return
    }
    const newTrackedChanges = []
    const retainedRange = new Range(cursor, length)
    for (const trackedChange of this._trackedChanges) {
      if (retainedRange.contains(trackedChange.range)) {
        // Remove the range
      } else if (retainedRange.overlaps(trackedChange.range)) {
        if (trackedChange.range.contains(retainedRange)) {
          const [leftRange, rightRange] = trackedChange.range.splitAt(cursor)
          if (!leftRange.isEmpty()) {
            newTrackedChanges.push(
              new TrackedChange(leftRange, trackedChange.tracking)
            )
          }
          if (!rightRange.isEmpty() && rightRange.length > length) {
            newTrackedChanges.push(
              new TrackedChange(
                rightRange.moveBy(length).shrinkBy(length),
                trackedChange.tracking
              )
            )
          }
        } else if (retainedRange.start <= trackedChange.range.start) {
          // overlaps to the left
          const [, reducedRange] = trackedChange.range.splitAt(
            retainedRange.end
          )
          if (!reducedRange.isEmpty()) {
            newTrackedChanges.push(
              new TrackedChange(reducedRange, trackedChange.tracking)
            )
          }
        } else {
          // overlaps to the right
          const [reducedRange] = trackedChange.range.splitAt(cursor)
          if (!reducedRange.isEmpty()) {
            newTrackedChanges.push(
              new TrackedChange(reducedRange, trackedChange.tracking)
            )
          }
        }
      } else {
        // keep the range
        newTrackedChanges.push(trackedChange)
      }
    }
    if (opts.tracking instanceof TrackingProps) {
      // This is a new tracked change
      const newTrackedChange = new TrackedChange(retainedRange, opts.tracking)
      newTrackedChanges.push(newTrackedChange)
    }
    this._trackedChanges = newTrackedChanges
  }

  /**
   * Apply a text operation to the list of tracked changes
   *
   * Ranges are merged only once at the end, for performance and to avoid
   * problematic edge cases where intermediate ranges get incorrectly merged.
   *
   * @param {TextOperation} operation
   */
  applyTextOperation(operation) {
    // this cursor tracks the destination document that gets modified as
    // operations are applied to it.
    let cursor = 0
    for (const op of operation.ops) {
      if (op instanceof InsertOp) {
        this._applyInsert(cursor, op.insertion, { tracking: op.tracking })
        cursor += op.insertion.length
      } else if (op instanceof RemoveOp) {
        this._applyDelete(cursor, op.length)
      } else if (op instanceof RetainOp) {
        this._applyRetain(cursor, op.length, { tracking: op.tracking })
        cursor += op.length
      }
    }
    this._mergeRanges()
  }
}

module.exports = TrackedChangeList

// @ts-check
const Range = require('../range')
const TrackedChange = require('./tracked_change')

/**
 * @typedef {import("../types").TrackedChangeRawData} TrackedChangeRawData
 * @typedef {import("../file_data/tracking_props")} TrackingProps
 */

class TrackedChangeList {
  /**
   *
   * @param {TrackedChange[]} trackedChanges
   */
  constructor(trackedChanges) {
    this.trackedChanges = trackedChanges
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
    return this.trackedChanges.map(change => change.toRaw())
  }

  get length() {
    return this.trackedChanges.length
  }

  /**
   * Returns the tracked changes that are fully included in the range
   * @param {Range} range
   * @returns {TrackedChange[]}
   */
  inRange(range) {
    return this.trackedChanges.filter(change => range.contains(change.range))
  }

  /**
   * Returns the tracking props for a given range.
   * @param {Range} range
   * @returns {TrackingProps | undefined}
   */
  propsAtRange(range) {
    return this.trackedChanges.find(change => change.range.contains(range))
      ?.tracking
  }

  /**
   * Removes the tracked changes that are fully included in the range
   * @param {Range} range
   */
  removeInRange(range) {
    this.trackedChanges = this.trackedChanges.filter(
      change => !range.contains(change.range)
    )
  }

  /**
   * Adds a tracked change to the list
   * @param {TrackedChange} trackedChange
   */
  add(trackedChange) {
    this.trackedChanges.push(trackedChange)
    this._mergeRanges()
  }

  /**
   * Collapses consecutive (and compatible) ranges
   * @returns {void}
   */
  _mergeRanges() {
    if (this.trackedChanges.length < 2) {
      return
    }
    // ranges are non-overlapping so we can sort based on their first indices
    this.trackedChanges.sort((a, b) => a.range.start - b.range.start)
    const newTrackedChanges = [this.trackedChanges[0]]
    for (let i = 1; i < this.trackedChanges.length; i++) {
      const last = newTrackedChanges[newTrackedChanges.length - 1]
      const current = this.trackedChanges[i]
      if (last.canMerge(current)) {
        newTrackedChanges[newTrackedChanges.length - 1] = last.merge(current)
      } else {
        newTrackedChanges.push(current)
      }
    }
    this.trackedChanges = newTrackedChanges
  }

  /**
   *
   * @param {number} cursor
   * @param {string} insertedText
   * @param {{tracking?: TrackingProps}} opts
   */
  applyInsert(cursor, insertedText, opts = {}) {
    const newTrackedChanges = []
    for (const trackedChange of this.trackedChanges) {
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
    this.trackedChanges = newTrackedChanges
    this._mergeRanges()
  }

  /**
   *
   * @param {number} cursor
   * @param {number} length
   */
  applyDelete(cursor, length) {
    const newTrackedChanges = []
    for (const trackedChange of this.trackedChanges) {
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
    this.trackedChanges = newTrackedChanges
    this._mergeRanges()
  }

  /**
   * @param {number} cursor
   * @param {number} length
   * @param {{tracking?: TrackingProps}} opts
   */
  applyRetain(cursor, length, opts = {}) {
    // If there's no tracking info, leave everything as-is
    if (!opts.tracking) {
      return
    }
    const newTrackedChanges = []
    const retainedRange = new Range(cursor, length)
    for (const trackedChange of this.trackedChanges) {
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
    if (opts.tracking?.type === 'delete' || opts.tracking?.type === 'insert') {
      // This is a new tracked change
      const newTrackedChange = new TrackedChange(retainedRange, opts.tracking)
      newTrackedChanges.push(newTrackedChange)
    }
    this.trackedChanges = newTrackedChanges
    this._mergeRanges()
  }
}

module.exports = TrackedChangeList

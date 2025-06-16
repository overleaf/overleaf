// @ts-check
const Range = require('../range')
const TrackingProps = require('./tracking_props')

/**
 * @import { TrackedChangeRawData } from "../types"
 */

class TrackedChange {
  /**
   * @param {Range} range
   * @param {TrackingProps} tracking
   */
  constructor(range, tracking) {
    /**
     * @readonly
     * @type {Range}
     */
    this.range = range
    /**
     * @readonly
     * @type {TrackingProps}
     */
    this.tracking = tracking
  }

  /**
   *
   * @param {TrackedChangeRawData} raw
   * @returns {TrackedChange}
   */
  static fromRaw(raw) {
    return new TrackedChange(
      Range.fromRaw(raw.range),
      TrackingProps.fromRaw(raw.tracking)
    )
  }

  /**
   * @returns {TrackedChangeRawData}
   */
  toRaw() {
    return {
      range: this.range.toRaw(),
      tracking: this.tracking.toRaw(),
    }
  }

  /**
   * Checks whether the tracked change can be merged with another
   * @param {TrackedChange} other
   * @returns {boolean}
   */
  canMerge(other) {
    if (!(other instanceof TrackedChange)) {
      return false
    }
    return (
      this.tracking.type === other.tracking.type &&
      this.tracking.userId === other.tracking.userId &&
      this.range.touches(other.range) &&
      this.range.canMerge(other.range)
    )
  }

  /**
   * Merges another tracked change into this, updating the range and tracking
   * timestamp
   * @param {TrackedChange} other
   * @returns {TrackedChange}
   */
  merge(other) {
    if (!this.canMerge(other)) {
      throw new Error('Cannot merge tracked changes')
    }
    return new TrackedChange(
      this.range.merge(other.range),
      new TrackingProps(
        this.tracking.type,
        this.tracking.userId,
        this.tracking.ts.getTime() > other.tracking.ts.getTime()
          ? this.tracking.ts
          : other.tracking.ts
      )
    )
  }

  /**
   * Return an equivalent tracked change whose extent is limited to the given
   * range
   *
   * @param {Range} range
   * @returns {TrackedChange | null} - the result or null if the intersection is empty
   */
  intersectRange(range) {
    const intersection = this.range.intersect(range)
    if (intersection == null) {
      return null
    }
    return new TrackedChange(intersection, this.tracking)
  }
}

module.exports = TrackedChange

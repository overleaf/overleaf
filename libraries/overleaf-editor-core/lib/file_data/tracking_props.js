// @ts-check
/**
 * @import { TrackingPropsRawData, TrackingDirective } from "../types"
 */

class TrackingProps {
  /**
   *
   * @param {'insert' | 'delete'} type
   * @param {string} userId
   * @param {Date} ts
   */
  constructor(type, userId, ts) {
    /**
     * @readonly
     * @type {'insert' | 'delete'}
     */
    this.type = type
    /**
     * @readonly
     * @type {string}
     */
    this.userId = userId
    /**
     * @readonly
     * @type {Date}
     */
    this.ts = ts
  }

  /**
   *
   * @param {TrackingPropsRawData} raw
   * @returns {TrackingProps}
   */
  static fromRaw(raw) {
    return new TrackingProps(raw.type, raw.userId, new Date(raw.ts))
  }

  /**
   * @returns {TrackingPropsRawData}
   */
  toRaw() {
    return {
      type: this.type,
      userId: this.userId,
      ts: this.ts.toISOString(),
    }
  }

  /**
   * @param {TrackingDirective} [other]
   * @returns {boolean}
   */
  equals(other) {
    if (!(other instanceof TrackingProps)) {
      return false
    }
    return (
      this.type === other.type &&
      this.userId === other.userId &&
      this.ts.getTime() === other.ts.getTime()
    )
  }
}

module.exports = TrackingProps

// @ts-check
/**
 * @typedef {import("../types").TrackedChangeRawData} TrackedChangeRawData
 */

class TrackingProps {
  /**
   *
   * @param {'insert' | 'delete' | 'none'} type
   * @param {string} userId
   * @param {Date} ts
   */
  constructor(type, userId, ts) {
    /**
     * @readonly
     * @type {'insert' | 'delete' | 'none'}
     */
    this.type = type
    /**
     * @readonly
     * @type {string}
     */
    this.userId = userId
    /**
     * @type {Date}
     */
    this.ts = ts
  }

  /**
   *
   * @param {TrackedChangeRawData['tracking']} raw
   * @returns
   */
  static fromRaw(raw) {
    return new TrackingProps(raw.type, raw.userId, new Date(raw.ts))
  }

  toRaw() {
    return {
      type: this.type,
      userId: this.userId,
      ts: this.ts.toISOString(),
    }
  }

  clone() {
    return new TrackingProps(this.type, this.userId, this.ts)
  }
}

module.exports = TrackingProps

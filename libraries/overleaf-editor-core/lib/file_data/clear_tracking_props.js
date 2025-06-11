// @ts-check

/**
 * @import { ClearTrackingPropsRawData, TrackingDirective } from '../types'
 */

class ClearTrackingProps {
  constructor() {
    this.type = 'none'
  }

  /**
   * @param {any} other
   * @returns {other is ClearTrackingProps}
   */
  equals(other) {
    return other instanceof ClearTrackingProps
  }

  /**
   * @param {TrackingDirective} other
   * @returns {other is ClearTrackingProps}
   */
  canMergeWith(other) {
    return other instanceof ClearTrackingProps
  }

  /**
   * @param {TrackingDirective} other
   */
  mergeWith(other) {
    return this
  }

  /**
   * @returns {ClearTrackingPropsRawData}
   */
  toRaw() {
    return { type: 'none' }
  }
}

module.exports = ClearTrackingProps

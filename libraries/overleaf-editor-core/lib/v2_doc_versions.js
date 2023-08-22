'use strict'

const _ = require('lodash')

/**
 * @typedef {import("./file")} File
 * @typedef {import("./types").RawV2DocVersions} RawV2DocVersions
 */

class V2DocVersions {
  /**
   * @param {RawV2DocVersions} data
   */
  constructor(data) {
    this.data = data || {}
  }

  static fromRaw(raw) {
    if (!raw) return undefined
    return new V2DocVersions(raw)
  }

  /**
   * @abstract
   */
  toRaw() {
    if (!this.data) return null
    const raw = _.clone(this.data)
    return raw
  }

  /**
   * Clone this object.
   *
   * @return {V2DocVersions} a new object of the same type
   */
  clone() {
    return V2DocVersions.fromRaw(this.toRaw())
  }

  applyTo(snapshot) {
    // Only update the snapshot versions if we have new versions
    if (!_.size(this.data)) return

    // Create v2DocVersions in snapshot if it does not exist
    // otherwise update snapshot v2docversions
    if (!snapshot.v2DocVersions) {
      snapshot.v2DocVersions = this.clone()
    } else {
      _.assign(snapshot.v2DocVersions.data, this.data)
    }
  }
}

module.exports = V2DocVersions

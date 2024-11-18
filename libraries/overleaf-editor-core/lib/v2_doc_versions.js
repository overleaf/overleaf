// @ts-check
'use strict'

const _ = require('lodash')

/**
 * @import File from "./file"
 * @import Snapshot from "./snapshot"
 * @import { RawV2DocVersions } from "./types"
 */

class V2DocVersions {
  /**
   * @param {RawV2DocVersions} data
   */
  constructor(data) {
    this.data = data || {}
  }

  /**
   * @param {RawV2DocVersions?} [raw]
   * @return {V2DocVersions|undefined}
   */
  static fromRaw(raw) {
    if (!raw) return undefined
    return new V2DocVersions(raw)
  }

  /**
   * @return {RawV2DocVersions|null}
   */
  toRaw() {
    if (!this.data) return null
    const raw = _.clone(this.data)
    return raw
  }

  /**
   * Clone this object.
   *
   * @return {V2DocVersions|undefined} a new object of the same type
   */
  clone() {
    return V2DocVersions.fromRaw(this.toRaw())
  }

  /**
   * @param {Snapshot} snapshot
   */
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

  /**
   * Move or remove a doc.
   * Must be called after FileMap#moveFile, which validates the paths.
   * @param {string} pathname
   * @param {string} newPathname
   */
  moveFile(pathname, newPathname) {
    for (const [id, v] of Object.entries(this.data)) {
      if (v.pathname !== pathname) continue

      if (newPathname === '') {
        delete this.data[id]
      } else {
        v.pathname = newPathname
      }
      break
    }
  }
}

module.exports = V2DocVersions

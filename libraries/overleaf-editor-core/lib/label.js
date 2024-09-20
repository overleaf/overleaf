// @ts-check
'use strict'

const assert = require('check-types').assert

/**
 * @import { RawLabel } from './types'
 */

/**
 * @classdesc
 * A user-configurable label that can be attached to a specific change. Labels
 * are not versioned, and they are not stored alongside the Changes in Chunks.
 * They are instead intended to provide external markers into the history of the
 * project.
 */
class Label {
  /**
   * @constructor
   * @param {string} text
   * @param {number?} authorId
   * @param {Date} timestamp
   * @param {number} version
   */
  constructor(text, authorId, timestamp, version) {
    assert.string(text, 'bad text')
    assert.maybe.integer(authorId, 'bad author id')
    assert.date(timestamp, 'bad timestamp')
    assert.integer(version, 'bad version')

    this.text = text
    this.authorId = authorId
    this.timestamp = timestamp
    this.version = version
  }

  /**
   * Create a Label from its raw form.
   *
   * @param {RawLabel} raw
   * @return {Label}
   */
  static fromRaw(raw) {
    return new Label(
      raw.text,
      raw.authorId,
      new Date(raw.timestamp),
      raw.version
    )
  }

  /**
   * Convert the Label to raw form for transmission.
   *
   * @return {RawLabel}
   */
  toRaw() {
    return {
      text: this.text,
      authorId: this.authorId,
      timestamp: this.timestamp.toISOString(),
      version: this.version,
    }
  }

  /**
   * @return {string}
   */
  getText() {
    return this.text
  }

  /**
   * The ID of the author, if any. Note that we now require all saved versions to
   * have an author, but this was not always the case, so we have to allow nulls
   * here for historical reasons.
   *
   * @return {number | null | undefined}
   */
  getAuthorId() {
    return this.authorId
  }

  /**
   * @return {Date}
   */
  getTimestamp() {
    return this.timestamp
  }

  /**
   * @return {number}
   */
  getVersion() {
    return this.version
  }
}

module.exports = Label

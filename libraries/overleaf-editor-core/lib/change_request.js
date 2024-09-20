'use strict'

const assert = require('check-types').assert

const AuthorList = require('./author_list')
const Change = require('./change')
const Operation = require('./operation')

/**
 * @import Author from "./author"
 */

/**
 * A `ChangeRequest` is a list of {@link Operation}s that the server can apply
 * as a {@link Change}.
 *
 * If the change is marked as `untransformable`, then the server will not
 * attempt to transform it if it is out of date (i.e. if the baseVersion no
 * longer matches the project's latest version). For example, if the client
 * needs to ensure that a metadata property is set on exactly one file, it can't
 * do that reliably if there's a chance that other clients will also change the
 * metadata at the same time. The expectation is that if the change is rejected,
 * the client will retry on a later version.
 */
class ChangeRequest {
  /**
   * @param {number} baseVersion
   * @param {Array.<Operation>} operations
   * @param {boolean} [untransformable]
   * @param {number[] | Author[]} [authors]
   */
  constructor(baseVersion, operations, untransformable, authors) {
    assert.integer(baseVersion, 'bad baseVersion')
    assert.array.of.object(operations, 'bad operations')
    assert.maybe.boolean(untransformable, 'ChangeRequest: bad untransformable')
    // TODO remove authors once we have JWTs working --- pass as parameter to
    // makeChange instead
    authors = authors || []

    // check all are the same type
    AuthorList.assertV1(authors, 'bad authors')

    this.authors = authors
    this.baseVersion = baseVersion
    this.operations = operations
    this.untransformable = untransformable || false
  }

  /**
   * For serialization.
   *
   * @return {Object}
   */
  toRaw() {
    function operationToRaw(operation) {
      return operation.toRaw()
    }

    return {
      baseVersion: this.baseVersion,
      operations: this.operations.map(operationToRaw),
      untransformable: this.untransformable,
      authors: this.authors,
    }
  }

  static fromRaw(raw) {
    assert.array.of.object(raw.operations, 'bad raw.operations')
    return new ChangeRequest(
      raw.baseVersion,
      raw.operations.map(Operation.fromRaw),
      raw.untransformable,
      raw.authors
    )
  }

  getBaseVersion() {
    return this.baseVersion
  }

  isUntransformable() {
    return this.untransformable
  }

  makeChange(timestamp) {
    return new Change(this.operations, timestamp, this.authors)
  }
}

module.exports = ChangeRequest

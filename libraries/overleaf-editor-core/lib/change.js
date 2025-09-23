'use strict'

const _ = require('lodash')
const assert = require('check-types').assert
const pMap = require('p-map')

const AuthorList = require('./author_list')
const Operation = require('./operation')
const Origin = require('./origin')
const Snapshot = require('./snapshot')
const FileMap = require('./file_map')
const V2DocVersions = require('./v2_doc_versions')

/**
 * @import Author from "./author"
 * @import { BlobStore, RawChange, ReadonlyBlobStore } from "./types"
 */

/**
 * A Change is a list of {@link Operation}s applied atomically by given
 * {@link Author}(s) at a given time.
 */
class Change {
  static PROJECT_VERSION_RX_STRING = '^[0-9]+\\.[0-9]+$'
  static PROJECT_VERSION_RX = new RegExp(Change.PROJECT_VERSION_RX_STRING)

  /**
   * @param {Array.<Operation>} operations
   * @param {Date} timestamp
   * @param {number[] | Author[]} [authors]
   * @param {Origin} [origin]
   * @param {string[]} [v2Authors]
   * @param {string} [projectVersion]
   * @param {V2DocVersions} [v2DocVersions]
   */
  constructor(
    operations,
    timestamp,
    authors,
    origin,
    v2Authors,
    projectVersion,
    v2DocVersions
  ) {
    this.setOperations(operations)
    this.setTimestamp(timestamp)
    this.setAuthors(authors || [])
    this.setOrigin(origin)
    this.setV2Authors(v2Authors || [])
    this.setProjectVersion(projectVersion)
    this.setV2DocVersions(v2DocVersions)
  }

  /**
   * For serialization.
   *
   * @return {RawChange}
   */
  toRaw() {
    function toRaw(object) {
      return object.toRaw()
    }
    const raw = {
      operations: this.operations.map(toRaw),
      timestamp: this.timestamp.toISOString(),
      authors: this.authors,
    }
    if (this.v2Authors) raw.v2Authors = this.v2Authors
    if (this.origin) raw.origin = this.origin.toRaw()
    if (this.projectVersion) raw.projectVersion = this.projectVersion
    if (this.v2DocVersions) raw.v2DocVersions = this.v2DocVersions.toRaw()
    return raw
  }

  static fromRaw(raw) {
    if (!raw) return null
    assert.array.of.object(raw.operations, 'bad raw.operations')
    assert.nonEmptyString(raw.timestamp, 'bad raw.timestamp')

    // Hack to clean up bad data where author id of some changes was 0, instead of
    // null. The root cause of the bug is fixed in
    // https://github.com/overleaf/write_latex/pull/3804 but the bad data persists
    // on S3
    let authors
    if (raw.authors) {
      authors = raw.authors.map(
        // Null represents an anonymous author
        author => (author === 0 ? null : author)
      )
    }

    return new Change(
      raw.operations.map(Operation.fromRaw),
      new Date(raw.timestamp),
      authors,
      raw.origin && Origin.fromRaw(raw.origin),
      raw.v2Authors,
      raw.projectVersion,
      raw.v2DocVersions && V2DocVersions.fromRaw(raw.v2DocVersions)
    )
  }

  /**
   * @return {Operation[]}
   */
  getOperations() {
    return this.operations
  }

  setOperations(operations) {
    assert.array.of.object(operations, 'Change: bad operations')
    this.operations = operations
  }

  getTimestamp() {
    return this.timestamp
  }

  setTimestamp(timestamp) {
    assert.date(timestamp, 'Change: bad timestamp')
    this.timestamp = timestamp
  }

  /**
   * @return {Array.<Author>} zero or more
   */
  getAuthors() {
    return this.authors
  }

  setAuthors(authors) {
    assert.array(authors, 'Change: bad author ids array')
    if (authors.length > 1) {
      assert.maybe.emptyArray(
        this.v2Authors,
        'Change: cannot set v1 authors if v2 authors is set'
      )
    }
    AuthorList.assertV1(authors, 'Change: bad author ids')

    this.authors = authors
  }

  /**
   * @return {Array.<Author>} zero or more
   */
  getV2Authors() {
    return this.v2Authors
  }

  setV2Authors(v2Authors) {
    assert.array(v2Authors, 'Change: bad v2 author ids array')
    if (v2Authors.length > 1) {
      assert.maybe.emptyArray(
        this.authors,
        'Change: cannot set v2 authors if v1 authors is set'
      )
    }
    AuthorList.assertV2(v2Authors, 'Change: not a v2 author id')
    this.v2Authors = v2Authors
  }

  /**
   * @return {Origin | null | undefined}
   */
  getOrigin() {
    return this.origin
  }

  setOrigin(origin) {
    assert.maybe.instance(origin, Origin, 'Change: bad origin')
    this.origin = origin
  }

  /**
   * @return {string | null | undefined}
   */
  getProjectVersion() {
    return this.projectVersion
  }

  setProjectVersion(projectVersion) {
    assert.maybe.match(
      projectVersion,
      Change.PROJECT_VERSION_RX,
      'Change: bad projectVersion'
    )
    this.projectVersion = projectVersion
  }

  /**
   * @return {V2DocVersions | null | undefined}
   */
  getV2DocVersions() {
    return this.v2DocVersions
  }

  setV2DocVersions(v2DocVersions) {
    assert.maybe.instance(
      v2DocVersions,
      V2DocVersions,
      'Change: bad v2DocVersions'
    )
    this.v2DocVersions = v2DocVersions
  }

  /**
   * If this Change references blob hashes, add them to the given set.
   *
   * @param  {Set.<String>} blobHashes
   */
  findBlobHashes(blobHashes) {
    for (const operation of this.operations) {
      operation.findBlobHashes(blobHashes)
    }
  }

  /**
   * If this Change contains any File objects, load them.
   *
   * @param {string} kind see {File#load}
   * @param {ReadonlyBlobStore} blobStore
   * @return {Promise<void>}
   */
  async loadFiles(kind, blobStore) {
    for (const operation of this.operations) {
      await operation.loadFiles(kind, blobStore)
    }
  }

  /**
   * Append an operation to the end of the operations list.
   *
   * @param {Operation} operation
   * @return {this}
   */
  pushOperation(operation) {
    this.getOperations().push(operation)
    return this
  }

  /**
   * Apply this change to a snapshot. All operations are applied, and then the
   * snapshot version is increased.
   *
   * Recoverable errors (caused by historical bad data) are ignored unless
   * opts.strict is true
   *
   * @param {Snapshot} snapshot modified in place
   * @param {object} opts
   * @param {boolean} [opts.strict] - Do not ignore recoverable errors
   */
  applyTo(snapshot, opts = {}) {
    // eslint-disable-next-line no-unused-vars
    for (const operation of this.iterativelyApplyTo(snapshot, opts)) {
      // Nothing to do: we're just consuming the iterator for the side effects
    }
  }

  /**
   * Generator that applies this change to a snapshot and yields each
   * operation after it has been applied.
   *
   * Recoverable errors (caused by historical bad data) are ignored unless
   * opts.strict is true
   *
   * @param {Snapshot} snapshot modified in place
   * @param {object} opts
   * @param {boolean} [opts.strict] - Do not ignore recoverable errors
   */
  *iterativelyApplyTo(snapshot, opts = {}) {
    assert.object(snapshot, 'bad snapshot')

    for (const operation of this.operations) {
      try {
        operation.applyTo(snapshot, opts)
      } catch (err) {
        const recoverable =
          err instanceof Snapshot.EditMissingFileError ||
          err instanceof FileMap.FileNotFoundError
        if (!recoverable || opts.strict) {
          throw err
        }
      }
      yield operation
    }

    // update project version if present in change
    if (this.projectVersion) {
      snapshot.setProjectVersion(this.projectVersion)
    }

    // update doc versions
    if (this.v2DocVersions) {
      snapshot.updateV2DocVersions(this.v2DocVersions)
    }

    snapshot.setTimestamp(this.timestamp)
  }

  /**
   * Transform this change to account for the fact that the other change occurred
   * simultaneously and was applied first.
   *
   * This change is modified in place (by transforming its operations).
   *
   * @param {Change} other
   */
  transformAfter(other) {
    assert.object(other, 'bad other')

    const thisOperations = this.getOperations()
    const otherOperations = other.getOperations()
    for (let i = 0; i < otherOperations.length; ++i) {
      for (let j = 0; j < thisOperations.length; ++j) {
        thisOperations[j] = Operation.transform(
          thisOperations[j],
          otherOperations[i]
        )[0]
      }
    }
  }

  clone() {
    return Change.fromRaw(this.toRaw())
  }

  async store(blobStore, concurrency) {
    assert.maybe.number(concurrency, 'bad concurrency')

    const raw = this.toRaw()
    raw.authors = _.uniq(raw.authors)

    const rawOperations = await pMap(
      this.operations,
      operation => operation.store(blobStore),
      { concurrency: concurrency || 1 }
    )
    raw.operations = rawOperations
    return raw
  }

  canBeComposedWith(other) {
    const operations = this.getOperations()
    const otherOperations = other.getOperations()

    // We ignore complex changes with more than 1 operation
    if (operations.length > 1 || otherOperations.length > 1) return false

    return operations[0].canBeComposedWith(otherOperations[0])
  }
}

module.exports = Change

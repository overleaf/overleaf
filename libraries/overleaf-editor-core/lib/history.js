'use strict'

const assert = require('check-types').assert
const pMap = require('p-map')

const Change = require('./change')
const Snapshot = require('./snapshot')

/**
 * @import { BlobStore, ReadonlyBlobStore } from "./types"
 */

class History {
  /**
   * @constructor
   * @param {Snapshot} snapshot
   * @param {Array.<Change>} changes
   *
   * @classdesc
   * A History is a {@link Snapshot} and a sequence of {@link Change}s that can
   * be applied to produce a new snapshot.
   */
  constructor(snapshot, changes) {
    assert.instance(snapshot, Snapshot, 'bad snapshot')
    assert.maybe.array.of.instance(changes, Change, 'bad changes')

    this.snapshot = snapshot
    /** @type {Array<Change>} */
    this.changes = changes || []
  }

  static fromRaw(raw) {
    return new History(
      Snapshot.fromRaw(raw.snapshot),
      raw.changes.map(Change.fromRaw)
    )
  }

  toRaw() {
    function changeToRaw(change) {
      return change.toRaw()
    }
    return {
      snapshot: this.snapshot.toRaw(),
      changes: this.changes.map(changeToRaw),
    }
  }

  getSnapshot() {
    return this.snapshot
  }

  getChanges() {
    return this.changes
  }

  countChanges() {
    return this.changes.length
  }

  /**
   * Add changes to this history.
   *
   * @param {Array.<Change>} changes
   */
  pushChanges(changes) {
    this.changes.push.apply(this.changes, changes)
  }

  /**
   * If this History references blob hashes, either in the Snapshot or the
   * Changes, add them to the given set.
   *
   * @param  {Set.<String>} blobHashes
   */
  findBlobHashes(blobHashes) {
    function findChangeBlobHashes(change) {
      change.findBlobHashes(blobHashes)
    }
    this.snapshot.findBlobHashes(blobHashes)
    this.changes.forEach(findChangeBlobHashes)
  }

  /**
   * If this History contains any File objects, load them.
   *
   * @param {string} kind see {File#load}
   * @param {ReadonlyBlobStore} blobStore
   * @return {Promise<void>}
   */
  async loadFiles(kind, blobStore) {
    async function loadChangeFiles(changes) {
      for (const change of changes) {
        await change.loadFiles(kind, blobStore)
      }
    }

    await Promise.all([
      this.snapshot.loadFiles(kind, blobStore),
      loadChangeFiles(this.changes),
    ])
  }

  /**
   * Return a version of this history that is suitable for long term storage.
   * This requires that we store the content of file objects in the provided
   * blobStore.
   *
   * @param {BlobStore} blobStore
   * @param {number} [concurrency] applies separately to files, changes and
   *                               operations
   * @return {Promise<import('overleaf-editor-core/lib/types').RawHistory>}
   */
  async store(blobStore, concurrency) {
    assert.maybe.number(concurrency, 'bad concurrency')

    /**
     * @param {Change} change
     */
    async function storeChange(change) {
      return await change.store(blobStore, concurrency)
    }

    const [rawSnapshot, rawChanges] = await Promise.all([
      this.snapshot.store(blobStore, concurrency),
      pMap(this.changes, storeChange, { concurrency: concurrency || 1 }),
    ])
    return {
      snapshot: rawSnapshot,
      changes: rawChanges,
    }
  }
}

module.exports = History

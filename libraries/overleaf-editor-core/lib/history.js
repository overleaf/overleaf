'use strict'

const assert = require('check-types').assert
const BPromise = require('bluebird')

const Change = require('./change')
const Snapshot = require('./snapshot')

/**
 * @typedef {import("./types").BlobStore} BlobStore
 */

/**
 * @constructor
 * @param {Snapshot} snapshot
 * @param {Array.<Change>} changes
 *
 * @classdesc
 * A History is a {@link Snapshot} and a sequence of {@link Change}s that can
 * be applied to produce a new snapshot.
 */
function History(snapshot, changes) {
  assert.instance(snapshot, Snapshot, 'bad snapshot')
  assert.maybe.array.of.instance(changes, Change, 'bad changes')

  this.snapshot = snapshot
  this.changes = changes || []
}

History.fromRaw = function historyFromRaw(raw) {
  return new History(
    Snapshot.fromRaw(raw.snapshot),
    raw.changes.map(Change.fromRaw)
  )
}

History.prototype.toRaw = function historyToRaw() {
  function changeToRaw(change) {
    return change.toRaw()
  }
  return {
    snapshot: this.snapshot.toRaw(),
    changes: this.changes.map(changeToRaw),
  }
}

History.prototype.getSnapshot = function () {
  return this.snapshot
}
History.prototype.getChanges = function () {
  return this.changes
}

History.prototype.countChanges = function historyCountChanges() {
  return this.changes.length
}

/**
 * Add changes to this history.
 *
 * @param {Array.<Change>} changes
 */
History.prototype.pushChanges = function historyPushChanges(changes) {
  this.changes.push.apply(this.changes, changes)
}

/**
 * If this History references blob hashes, either in the Snapshot or the
 * Changes, add them to the given set.
 *
 * @param  {Set.<String>} blobHashes
 */
History.prototype.findBlobHashes = function historyFindBlobHashes(blobHashes) {
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
 * @param {BlobStore} blobStore
 * @return {Promise}
 */
History.prototype.loadFiles = function historyLoadFiles(kind, blobStore) {
  function loadChangeFiles(change) {
    return change.loadFiles(kind, blobStore)
  }
  return BPromise.join(
    this.snapshot.loadFiles(kind, blobStore),
    BPromise.each(this.changes, loadChangeFiles)
  )
}

/**
 * Return a version of this history that is suitable for long term storage.
 * This requires that we store the content of file objects in the provided
 * blobStore.
 *
 * @param {BlobStore} blobStore
 * @param {number} [concurrency] applies separately to files, changes and
 *                               operations
 * @return {Promise.<Object>}
 */
History.prototype.store = function historyStoreFunc(blobStore, concurrency) {
  assert.maybe.number(concurrency, 'bad concurrency')

  function storeChange(change) {
    return change.store(blobStore, concurrency)
  }
  return BPromise.join(
    this.snapshot.store(blobStore, concurrency),
    BPromise.map(this.changes, storeChange, { concurrency: concurrency || 1 })
  ).then(([rawSnapshot, rawChanges]) => {
    return {
      snapshot: rawSnapshot,
      changes: rawChanges,
    }
  })
}

module.exports = History

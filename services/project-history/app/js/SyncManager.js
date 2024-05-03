// @ts-check

import _ from 'lodash'
import { callbackify, promisify } from 'util'
import { callbackifyMultiResult } from '@overleaf/promise-utils'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import Metrics from '@overleaf/metrics'
import OError from '@overleaf/o-error'
import { File } from 'overleaf-editor-core'
import { SyncError } from './Errors.js'
import { db, ObjectId } from './mongodb.js'
import * as SnapshotManager from './SnapshotManager.js'
import * as LockManager from './LockManager.js'
import * as UpdateTranslator from './UpdateTranslator.js'
import * as UpdateCompressor from './UpdateCompressor.js'
import * as WebApiManager from './WebApiManager.js'
import * as ErrorRecorder from './ErrorRecorder.js'
import * as RedisManager from './RedisManager.js'
import * as HistoryStoreManager from './HistoryStoreManager.js'
import * as HashManager from './HashManager.js'

/**
 * @typedef {import('overleaf-editor-core').Comment} HistoryComment
 * @typedef {import('./types').Comment} Comment
 * @typedef {import('./types').Entity} Entity
 * @typedef {import('./types').ResyncDocContentUpdate} ResyncDocContentUpdate
 * @typedef {import('./types').Update} Update
 */
const MAX_RESYNC_HISTORY_RECORDS = 100 // keep this many records of previous resyncs
const EXPIRE_RESYNC_HISTORY_INTERVAL_MS = 90 * 24 * 3600 * 1000 // 90 days

const keys = Settings.redis.lock.key_schema

// db.projectHistorySyncState.ensureIndex({expiresAt: 1}, {expireAfterSeconds: 0, background: true})
// To add expiresAt field to existing entries in collection (choose a suitable future expiry date):
// db.projectHistorySyncState.updateMany({resyncProjectStructure: false, resyncDocContents: [], expiresAt: {$exists:false}}, {$set: {expiresAt: new Date("2019-07-01")}})

async function startResync(projectId, options = {}) {
  // We have three options here
  //
  // 1. If we update mongo before making the call to web then there's a
  //    chance we ignore all updates indefinitely (there's no foolproff way
  //    to undo the change in mongo)
  //
  // 2. If we make the call to web first then there is a small race condition
  //    where we could process the sync update and then only update mongo
  //    after, causing all updates to be ignored from then on
  //
  // 3. We can wrap everything in a project lock
  Metrics.inc('project_history_resync')
  try {
    await LockManager.promises.runWithLock(
      keys.projectHistoryLock({ project_id: projectId }),
      async extendLock => {
        await _startResyncWithoutLock(projectId, options)
      }
    )
  } catch (error) {
    // record error in starting sync ("sync ongoing")
    try {
      await ErrorRecorder.promises.record(projectId, -1, error)
    } catch (err) {
      // swallow any error thrown by ErrorRecorder.record()
    }
    throw error
  }
}

async function startHardResync(projectId, options = {}) {
  Metrics.inc('project_history_hard_resync')
  try {
    await LockManager.promises.runWithLock(
      keys.projectHistoryLock({ project_id: projectId }),
      async extendLock => {
        await clearResyncState(projectId)
        await RedisManager.promises.clearFirstOpTimestamp(projectId)
        await RedisManager.promises.destroyDocUpdatesQueue(projectId)
        await _startResyncWithoutLock(projectId, options)
      }
    )
  } catch (error) {
    // record error in starting sync ("sync ongoing")
    await ErrorRecorder.promises.record(projectId, -1, error)
    throw error
  }
}

async function _startResyncWithoutLock(projectId, options) {
  await ErrorRecorder.promises.recordSyncStart(projectId)

  const syncState = await _getResyncState(projectId)
  if (syncState.isSyncOngoing()) {
    throw new OError('sync ongoing')
  }
  syncState.setOrigin(options.origin || { kind: 'history-resync' })
  syncState.startProjectStructureSync()

  await WebApiManager.promises.requestResync(projectId)
  await setResyncState(projectId, syncState)
}

async function _getResyncState(projectId) {
  const rawSyncState = await db.projectHistorySyncState.findOne({
    project_id: new ObjectId(projectId.toString()),
  })
  const syncState = SyncState.fromRaw(projectId, rawSyncState)
  return syncState
}

async function setResyncState(projectId, syncState) {
  // skip if syncState is null (i.e. unchanged)
  if (syncState == null) {
    return
  }
  const update = {
    $set: syncState.toRaw(),
    $push: {
      history: {
        $each: [{ syncState: syncState.toRaw(), timestamp: new Date() }],
        $position: 0,
        $slice: MAX_RESYNC_HISTORY_RECORDS,
      },
    },
    $currentDate: { lastUpdated: true },
  }

  // handle different cases
  if (syncState.isSyncOngoing()) {
    // starting a new sync; prevent the entry expiring while sync is in ongoing
    update.$inc = { resyncCount: 1 }
    update.$unset = { expiresAt: true }
  } else {
    // successful completion of existing sync; set the entry to expire in the
    // future
    update.$set.expiresAt = new Date(
      Date.now() + EXPIRE_RESYNC_HISTORY_INTERVAL_MS
    )
  }

  // apply the update
  await db.projectHistorySyncState.updateOne(
    { project_id: new ObjectId(projectId) },
    update,
    { upsert: true }
  )
}

async function clearResyncState(projectId) {
  await db.projectHistorySyncState.deleteOne({
    project_id: new ObjectId(projectId.toString()),
  })
}

async function skipUpdatesDuringSync(projectId, updates) {
  const syncState = await _getResyncState(projectId)
  if (!syncState.isSyncOngoing()) {
    logger.debug({ projectId }, 'not skipping updates: no resync in progress')
    // don't return syncState when unchanged
    return { updates, syncState: null }
  }

  const filteredUpdates = []

  for (const update of updates) {
    syncState.updateState(update)
    const shouldSkipUpdate = syncState.shouldSkipUpdate(update)
    if (!shouldSkipUpdate) {
      filteredUpdates.push(update)
    } else {
      logger.debug({ projectId, update }, 'skipping update due to resync')
    }
  }
  return { updates: filteredUpdates, syncState }
}

async function expandSyncUpdates(
  projectId,
  projectHistoryId,
  updates,
  extendLock
) {
  const areSyncUpdatesQueued =
    _.some(updates, 'resyncProjectStructure') ||
    _.some(updates, 'resyncDocContent')
  if (!areSyncUpdatesQueued) {
    logger.debug({ projectId }, 'no resync updates to expand')
    return updates
  }

  const syncState = await _getResyncState(projectId)

  // compute the current snapshot from the most recent chunk
  const snapshotFiles = await SnapshotManager.promises.getLatestSnapshot(
    projectId,
    projectHistoryId
  )

  // check if snapshot files are valid
  const invalidFiles = _.pickBy(
    snapshotFiles,
    (v, k) => v == null || typeof v.isEditable !== 'function'
  )
  if (_.size(invalidFiles) > 0) {
    throw new SyncError('file is missing isEditable method', {
      projectId,
      invalidFiles,
    })
  }

  const expander = new SyncUpdateExpander(
    projectId,
    snapshotFiles,
    syncState.origin
  )

  // expand updates asynchronously to avoid blocking
  for (const update of updates) {
    await expander.expandUpdate(update)
    await extendLock()
  }

  return expander.getExpandedUpdates()
}

class SyncState {
  constructor(projectId, resyncProjectStructure, resyncDocContents, origin) {
    this.projectId = projectId
    this.resyncProjectStructure = resyncProjectStructure
    this.resyncDocContents = resyncDocContents
    this.origin = origin
  }

  static fromRaw(projectId, rawSyncState) {
    rawSyncState = rawSyncState || {}
    const resyncProjectStructure = rawSyncState.resyncProjectStructure || false
    const resyncDocContents = new Set(rawSyncState.resyncDocContents || [])
    const origin = rawSyncState.origin
    return new SyncState(
      projectId,
      resyncProjectStructure,
      resyncDocContents,
      origin
    )
  }

  toRaw() {
    return {
      resyncProjectStructure: this.resyncProjectStructure,
      resyncDocContents: Array.from(this.resyncDocContents),
      origin: this.origin,
    }
  }

  updateState(update) {
    if (update.resyncProjectStructure != null) {
      if (!this.isProjectStructureSyncing()) {
        throw new SyncError('unexpected resyncProjectStructure update', {
          projectId: this.projectId,
          resyncProjectStructure: this.resyncProjectStructure,
        })
      }
      if (this.isAnyDocContentSyncing()) {
        throw new SyncError('unexpected resyncDocContents update', {
          projectId: this.projectId,
          resyncDocContents: this.resyncDocContents,
        })
      }

      for (const doc of update.resyncProjectStructure.docs) {
        this.startDocContentSync(doc.path)
      }

      this.stopProjectStructureSync()
    } else if (update.resyncDocContent != null) {
      if (this.isProjectStructureSyncing()) {
        throw new SyncError('unexpected resyncDocContent update', {
          projectId: this.projectId,
          resyncProjectStructure: this.resyncProjectStructure,
        })
      }

      if (!this.isDocContentSyncing(update.path)) {
        throw new SyncError('unexpected resyncDocContent update', {
          projectId: this.projectId,
          resyncDocContents: this.resyncDocContents,
          path: update.path,
        })
      }

      this.stopDocContentSync(update.path)
    }
  }

  setOrigin(origin) {
    this.origin = origin
  }

  shouldSkipUpdate(update) {
    // don't skip sync updates
    if (
      update.resyncProjectStructure != null ||
      update.resyncDocContent != null
    ) {
      return false
    }

    // if syncing project structure skip update
    if (this.isProjectStructureSyncing()) {
      return true
    }

    // skip text updates for a docs being synced
    if (UpdateTranslator.isTextUpdate(update)) {
      if (this.isDocContentSyncing(update.meta.pathname)) {
        return true
      }
    }

    // preserve all other updates
    return false
  }

  startProjectStructureSync() {
    this.resyncProjectStructure = true
    this.resyncDocContents = new Set([])
  }

  stopProjectStructureSync() {
    this.resyncProjectStructure = false
  }

  stopDocContentSync(pathname) {
    this.resyncDocContents.delete(pathname)
  }

  startDocContentSync(pathname) {
    this.resyncDocContents.add(pathname)
  }

  isProjectStructureSyncing() {
    return this.resyncProjectStructure
  }

  isDocContentSyncing(pathname) {
    return this.resyncDocContents.has(pathname)
  }

  isAnyDocContentSyncing() {
    return this.resyncDocContents.size > 0
  }

  isSyncOngoing() {
    return this.isProjectStructureSyncing() || this.isAnyDocContentSyncing()
  }
}

class SyncUpdateExpander {
  /**
   * Build a SyncUpdateExpander
   *
   * @param {string} projectId
   * @param {Record<string, File>} snapshotFiles
   * @param {string} origin
   */
  constructor(projectId, snapshotFiles, origin) {
    this.projectId = projectId
    this.files = snapshotFiles
    this.expandedUpdates = []
    this.origin = origin
  }

  // If there's an expected *file* with the same path and either the same hash
  // or no hash, treat this as not editable even if history thinks it is.
  isEditable(filePath, file, expectedFiles) {
    if (!file.isEditable()) {
      return false
    }
    const fileHash = _.get(file, ['data', 'hash'])
    const matchedExpectedFile = expectedFiles.some(item => {
      const expectedFileHash = item._hash
      if (expectedFileHash && fileHash !== expectedFileHash) {
        // expected file has a hash and it doesn't match
        return false
      }
      return UpdateTranslator._convertPathname(item.path) === filePath
    })

    // consider editable file in history as binary, since it matches a binary file in the project
    return !matchedExpectedFile
  }

  /**
   * @param {Update} update
   */
  async expandUpdate(update) {
    if ('resyncProjectStructure' in update) {
      logger.debug(
        { projectId: this.projectId, update },
        'expanding resyncProjectStructure update'
      )
      const persistedNonBinaryFileEntries = _.pickBy(this.files, (v, k) =>
        this.isEditable(k, v, update.resyncProjectStructure.files)
      )
      const persistedNonBinaryFiles = _.map(
        Object.keys(persistedNonBinaryFileEntries),
        path => ({
          path,
        })
      )

      const persistedBinaryFileEntries = _.omitBy(this.files, (v, k) =>
        this.isEditable(k, v, update.resyncProjectStructure.files)
      )
      // preserve file properties on binary files, for future comparison.
      const persistedBinaryFiles = _.map(
        persistedBinaryFileEntries,
        (entity, key) => Object.assign({}, entity, { path: key })
      )
      const expectedNonBinaryFiles = _.map(
        update.resyncProjectStructure.docs,
        entity =>
          Object.assign({}, entity, {
            path: UpdateTranslator._convertPathname(entity.path),
          })
      )
      const expectedBinaryFiles = _.map(
        update.resyncProjectStructure.files,
        entity =>
          Object.assign({}, entity, {
            path: UpdateTranslator._convertPathname(entity.path),
          })
      )

      // We need to detect and fix consistency issues where web and
      // history-store disagree on whether an entity is binary or not. Thus we
      // need to remove and add the two separately.
      this.queueRemoveOpsForUnexpectedFiles(
        update,
        expectedBinaryFiles,
        persistedBinaryFiles
      )
      this.queueRemoveOpsForUnexpectedFiles(
        update,
        expectedNonBinaryFiles,
        persistedNonBinaryFiles
      )
      this.queueAddOpsForMissingFiles(
        update,
        expectedBinaryFiles,
        persistedBinaryFiles
      )
      this.queueAddOpsForMissingFiles(
        update,
        expectedNonBinaryFiles,
        persistedNonBinaryFiles
      )
      this.queueUpdateForOutOfSyncBinaryFiles(
        update,
        expectedBinaryFiles,
        persistedBinaryFiles
      )
    } else if ('resyncDocContent' in update) {
      logger.debug(
        { projectId: this.projectId, update },
        'expanding resyncDocContent update'
      )
      await this.expandResyncDocContentUpdate(update)
    } else {
      this.expandedUpdates.push(update)
    }
  }

  getExpandedUpdates() {
    return this.expandedUpdates
  }

  /**
   * @param {Entity[]} expectedFiles
   * @param {{ path: string }[]} persistedFiles
   */
  queueRemoveOpsForUnexpectedFiles(update, expectedFiles, persistedFiles) {
    const unexpectedFiles = _.differenceBy(
      persistedFiles,
      expectedFiles,
      'path'
    )
    for (const entity of unexpectedFiles) {
      update = {
        pathname: entity.path,
        new_pathname: '',
        meta: {
          resync: true,
          origin: this.origin,
          ts: update.meta.ts,
        },
      }
      this.expandedUpdates.push(update)
      Metrics.inc('project_history_resync_operation', 1, {
        status: 'remove unexpected file',
      })
    }
  }

  /**
   * @param {Entity[]} expectedFiles
   * @param {{ path: string }[]} persistedFiles
   */
  queueAddOpsForMissingFiles(update, expectedFiles, persistedFiles) {
    const missingFiles = _.differenceBy(expectedFiles, persistedFiles, 'path')
    for (const entity of missingFiles) {
      update = {
        pathname: entity.path,
        meta: {
          resync: true,
          origin: this.origin,
          ts: update.meta.ts,
        },
      }

      if ('doc' in entity) {
        update.doc = entity.doc
        update.docLines = ''
        // we have to create a dummy entry here because later we will need the content in the diff computation
        this.files[update.pathname] = File.fromString('')
      } else {
        update.file = entity.file
        update.url = entity.url
      }

      this.expandedUpdates.push(update)
      Metrics.inc('project_history_resync_operation', 1, {
        status: 'add missing file',
      })
    }
  }

  queueUpdateForOutOfSyncBinaryFiles(update, expectedFiles, persistedFiles) {
    // create a map to lookup persisted files by their path
    const persistedFileMap = new Map(persistedFiles.map(x => [x.path, x]))
    // now search for files with same path but different hash values
    const differentFiles = expectedFiles.filter(expected => {
      // check for a persisted file at the same path
      const expectedPath = expected.path
      const persistedFileAtSamePath = persistedFileMap.get(expectedPath)
      if (!persistedFileAtSamePath) return false
      // check if the persisted file at the same path has a different hash
      const expectedHash = _.get(expected, '_hash')
      const persistedHash = _.get(persistedFileAtSamePath, ['data', 'hash'])
      const hashesPresent = expectedHash && persistedHash
      return hashesPresent && persistedHash !== expectedHash
    })
    for (const entity of differentFiles) {
      // remove the outdated persisted file
      const removeUpdate = {
        pathname: entity.path,
        new_pathname: '',
        meta: {
          resync: true,
          origin: this.origin,
          ts: update.meta.ts,
        },
      }
      this.expandedUpdates.push(removeUpdate)
      // add the new file content
      const addUpdate = {
        pathname: entity.path,
        meta: {
          resync: true,
          origin: this.origin,
          ts: update.meta.ts,
        },
        file: entity.file,
        url: entity.url,
      }
      this.expandedUpdates.push(addUpdate)
      Metrics.inc('project_history_resync_operation', 1, {
        status: 'update binary file contents',
      })
    }
  }

  /**
   * Expand a resyncDocContentUpdate
   *
   * @param {ResyncDocContentUpdate} update
   */
  async expandResyncDocContentUpdate(update) {
    const pathname = UpdateTranslator._convertPathname(update.path)
    const snapshotFile = this.files[pathname]
    const expectedFile = update.resyncDocContent
    const expectedContent = expectedFile.content

    if (!snapshotFile) {
      throw new OError('unrecognised file: not in snapshot')
    }

    // Compare hashes to see if the persisted file matches the expected content.
    // The hash of the persisted files is stored in the snapshot.
    // Note getHash() returns the hash only when the persisted file has
    // no changes in the snapshot, the hash is null if there are changes
    // that apply to it.
    let hashesMatch = false
    const persistedHash = snapshotFile.getHash()
    if (persistedHash != null) {
      const expectedHash = HashManager._getBlobHashFromString(expectedContent)
      if (persistedHash === expectedHash) {
        logger.debug(
          { projectId: this.projectId, persistedHash, expectedHash },
          'skipping diff because hashes match and persisted file has no ops'
        )
        hashesMatch = true
      }
    } else {
      logger.debug('cannot compare hashes, will retrieve content')
    }

    // compute the difference between the expected and persisted content
    const historyId = await WebApiManager.promises.getHistoryId(this.projectId)
    const file = await snapshotFile.load(
      'eager',
      HistoryStoreManager.getBlobStore(historyId)
    )
    const persistedContent = file.getContent()
    if (persistedContent == null) {
      // This should not happen given that we loaded the file eagerly. We could
      // probably refine the types in overleaf-editor-core so that this check
      // wouldn't be necessary.
      throw new Error('File was not properly loaded')
    }

    if (!hashesMatch) {
      await this.queueUpdateForOutOfSyncContent(
        update,
        pathname,
        persistedContent,
        expectedContent
      )
    }

    const persistedComments = file.getComments().toArray()
    await this.queueUpdateForOutOfSyncComments(
      update,
      pathname,
      persistedContent,
      persistedComments
    )
  }

  /**
   * Queue update for out of sync content
   *
   * @param {ResyncDocContentUpdate} update
   * @param {string} pathname
   * @param {string} persistedContent
   * @param {string} expectedContent
   */
  async queueUpdateForOutOfSyncContent(
    update,
    pathname,
    persistedContent,
    expectedContent
  ) {
    logger.debug(
      { projectId: this.projectId, persistedContent, expectedContent },
      'diffing doc contents'
    )
    const op = UpdateCompressor.diffAsShareJsOps(
      persistedContent,
      expectedContent
    )
    if (op.length === 0) {
      return
    }
    const expandedUpdate = {
      doc: update.doc,
      op,
      meta: {
        resync: true,
        origin: this.origin,
        ts: update.meta.ts,
        pathname,
        doc_length: persistedContent.length,
      },
    }
    logger.debug(
      { projectId: this.projectId, diffCount: op.length },
      'doc contents differ'
    )
    this.expandedUpdates.push(expandedUpdate)
    Metrics.inc('project_history_resync_operation', 1, {
      status: 'update text file contents',
    })
  }

  /**
   * Queue update for out of sync comments
   *
   * @param {ResyncDocContentUpdate} update
   * @param {string} pathname
   * @param {string} persistedContent
   * @param {HistoryComment[]} persistedComments
   */
  async queueUpdateForOutOfSyncComments(
    update,
    pathname,
    persistedContent,
    persistedComments
  ) {
    const expectedComments = update.resyncDocContent.ranges?.comments ?? []
    const resolvedComments = new Set(
      update.resyncDocContent.resolvedComments ?? []
    )
    const expectedCommentsById = new Map(
      expectedComments.map(comment => [comment.id, comment])
    )
    const persistedCommentsById = new Map(
      persistedComments.map(comment => [comment.id, comment])
    )

    // Delete any persisted comment that is not in the expected comment list.
    for (const persistedComment of persistedComments) {
      if (!expectedCommentsById.has(persistedComment.id)) {
        this.expandedUpdates.push({
          pathname,
          deleteComment: persistedComment.id,
          meta: {
            resync: true,
            origin: this.origin,
            ts: update.meta.ts,
          },
        })
      }
    }

    for (const expectedComment of expectedComments) {
      const persistedComment = persistedCommentsById.get(expectedComment.id)
      if (
        persistedComment != null &&
        commentRangesAreInSync(persistedComment, expectedComment)
      ) {
        const expectedCommentResolved = resolvedComments.has(expectedComment.id)
        if (expectedCommentResolved === persistedComment.resolved) {
          // Both comments are identical; do nothing
        } else {
          // Only the resolved state differs
          this.expandedUpdates.push({
            pathname,
            commentId: expectedComment.id,
            resolved: expectedCommentResolved,
          })
        }
      } else {
        // New comment or ranges differ
        this.expandedUpdates.push({
          doc: update.doc,
          op: [expectedComment.op],
          meta: {
            resync: true,
            origin: this.origin,
            ts: update.meta.ts,
            pathname,
            doc_length: persistedContent.length,
          },
        })
      }
    }
  }
}

/**
 * Compares the ranges in the persisted and expected comments
 *
 * @param {HistoryComment} persistedComment
 * @param {Comment} expectedComment
 */
function commentRangesAreInSync(persistedComment, expectedComment) {
  if (persistedComment.ranges.length !== 1) {
    // The editor only supports single range comments
    return false
  }
  const persistedRange = persistedComment.ranges[0]
  const expectedPos = expectedComment.op.hpos ?? expectedComment.op.p
  const expectedLength = expectedComment.op.hlen ?? expectedComment.op.c.length
  return (
    persistedRange.pos === expectedPos &&
    persistedRange.length === expectedLength
  )
}

// EXPORTS

const startResyncCb = callbackify(startResync)
const startHardResyncCb = callbackify(startHardResync)
const setResyncStateCb = callbackify(setResyncState)
const clearResyncStateCb = callbackify(clearResyncState)
const skipUpdatesDuringSyncCb = callbackifyMultiResult(skipUpdatesDuringSync, [
  'updates',
  'syncState',
])
const expandSyncUpdatesCb = (
  projectId,
  projectHistoryId,
  updates,
  extendLock,
  callback
) => {
  const extendLockPromises = promisify(extendLock)
  expandSyncUpdates(projectId, projectHistoryId, updates, extendLockPromises)
    .then(result => {
      callback(null, result)
    })
    .catch(err => {
      callback(err)
    })
}

export {
  startResyncCb as startResync,
  startHardResyncCb as startHardResync,
  setResyncStateCb as setResyncState,
  clearResyncStateCb as clearResyncState,
  skipUpdatesDuringSyncCb as skipUpdatesDuringSync,
  expandSyncUpdatesCb as expandSyncUpdates,
}

export const promises = {
  startResync,
  startHardResync,
  setResyncState,
  clearResyncState,
  skipUpdatesDuringSync,
  expandSyncUpdates,
}

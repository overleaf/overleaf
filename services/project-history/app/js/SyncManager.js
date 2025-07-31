// @ts-check

import _ from 'lodash'
import { callbackify, promisify } from 'node:util'
import { callbackifyMultiResult } from '@overleaf/promise-utils'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import Metrics from '@overleaf/metrics'
import OError from '@overleaf/o-error'
import { File, Range } from 'overleaf-editor-core'
import { NeedFullProjectStructureResyncError, SyncError } from './Errors.js'
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
import { isInsert, isDelete } from './Utils.js'

/**
 * @import { Comment as HistoryComment, TrackedChange as HistoryTrackedChange } from 'overleaf-editor-core'
 * @import { CommentRawData, TrackedChangeRawData } from 'overleaf-editor-core/lib/types'
 * @import { Comment, Entity, ResyncDocContentUpdate, RetainOp, TrackedChange } from './types'
 * @import { TrackedChangeTransition, TrackingDirective, TrackingType, Update } from './types'
 * @import { ProjectStructureUpdate } from './types'
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
        await startResyncWithoutLock(projectId, options)
      }
    )
  } catch (error) {
    // record error in starting sync ("sync ongoing")
    if (error instanceof Error) {
      await ErrorRecorder.promises.record(projectId, -1, error)
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
        await startResyncWithoutLock(projectId, options)
      }
    )
  } catch (error) {
    // record error in starting sync ("sync ongoing")
    if (error instanceof Error) {
      await ErrorRecorder.promises.record(projectId, -1, error)
    }
    throw error
  }
}

// The caller must hold the lock and should record any errors via the ErrorRecorder.
async function startResyncWithoutLock(projectId, options) {
  await ErrorRecorder.promises.recordSyncStart(projectId)

  const syncState = await _getResyncState(projectId)
  if (syncState.isSyncOngoing()) {
    throw new OError('sync ongoing')
  }
  syncState.setOrigin(options.origin || { kind: 'history-resync' })
  syncState.startProjectStructureSync()

  const webOpts = {}
  if (options.historyRangesMigration) {
    webOpts.historyRangesMigration = options.historyRangesMigration
  }
  if (options.resyncProjectStructureOnly) {
    webOpts.resyncProjectStructureOnly = options.resyncProjectStructureOnly
  }
  await WebApiManager.promises.requestResync(projectId, webOpts)
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

/**
 * @param {string} projectId
 * @param {Date} date
 * @return {Promise<void>}
 */
async function clearResyncStateIfAllAfter(projectId, date) {
  const rawSyncState = await db.projectHistorySyncState.findOne({
    project_id: new ObjectId(projectId.toString()),
  })
  if (!rawSyncState) return // already cleared
  const state = SyncState.fromRaw(projectId, rawSyncState)
  if (state.isSyncOngoing()) return // new sync started
  for (const { timestamp } of rawSyncState.history) {
    if (timestamp < date) return // preserve old resync states
  }
  // expiresAt is cleared when starting a sync and bumped when making changes.
  // Use expiresAt as read to ensure we only clear the confirmed state.
  await db.projectHistorySyncState.deleteOne({
    project_id: new ObjectId(projectId.toString()),
    expiresAt: rawSyncState.expiresAt,
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

/**
 * @param {string} projectId
 * @param {string} projectHistoryId
 * @param {{chunk: import('overleaf-editor-core/lib/types.js').RawChunk}} mostRecentChunk
 * @param {Array<Update>} updates
 * @param {() => Promise<void>} extendLock
 * @return {Promise<Array<Update>>}
 */
async function expandSyncUpdates(
  projectId,
  projectHistoryId,
  mostRecentChunk,
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
  const snapshotFiles =
    await SnapshotManager.promises.getLatestSnapshotFilesForChunk(
      projectHistoryId,
      mostRecentChunk
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

      if (!update.resyncProjectStructureOnly) {
        for (const doc of update.resyncProjectStructure.docs) {
          this.startDocContentSync(doc.path)
        }
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
    this.expandedUpdates = /** @type ProjectStructureUpdate[] */ []
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
      this.queueSetMetadataOpsForLinkedFiles(update)

      if (update.resyncProjectStructureOnly) {
        const docPaths = new Set()
        for (const entity of update.resyncProjectStructure.docs) {
          const path = UpdateTranslator._convertPathname(entity.path)
          docPaths.add(path)
        }
        for (const expandedUpdate of this.expandedUpdates) {
          if (docPaths.has(expandedUpdate.pathname)) {
            // Clear the resync state and queue entry, we need to start over.
            this.expandedUpdates = []
            await clearResyncState(this.projectId)
            await RedisManager.promises.deleteAppliedDocUpdate(
              this.projectId,
              update
            )
            throw new NeedFullProjectStructureResyncError(
              'aborting partial resync: touched doc'
            )
          }
        }
      }
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
        if (entity.url) update.url = entity.url
        if (entity._hash) update.hash = entity._hash
        if (entity.createdBlob) update.createdBlob = entity.createdBlob
        if (entity.metadata) update.metadata = entity.metadata
      }

      this.expandedUpdates.push(update)
      Metrics.inc('project_history_resync_operation', 1, {
        status: 'add missing file',
      })
    }
  }

  queueSetMetadataOpsForLinkedFiles(update) {
    const allEntities = update.resyncProjectStructure.docs.concat(
      update.resyncProjectStructure.files
    )
    for (const file of allEntities) {
      const pathname = UpdateTranslator._convertPathname(file.path)
      const matchingAddFileOperation = this.expandedUpdates.some(
        // Look for an addFile operation that already syncs the metadata.
        u => u.pathname === pathname && u.metadata === file.metadata
      )
      if (matchingAddFileOperation) continue
      const metaData = this.files[pathname].getMetadata()

      let shouldUpdate = false
      if (file.metadata) {
        // check for in place update of linked-file
        shouldUpdate = Object.entries(file.metadata).some(
          ([k, v]) => metaData[k] !== v
        )
      } else if (metaData.provider) {
        // overwritten by non-linked-file with same hash
        // or overwritten by doc
        shouldUpdate = true
      }
      if (!shouldUpdate) continue

      this.expandedUpdates.push({
        pathname,
        meta: {
          resync: true,
          origin: this.origin,
          ts: update.meta.ts,
        },
        metadata: file.metadata || {},
      })
      Metrics.inc('project_history_resync_operation', 1, {
        status: 'update metadata',
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
      }
      if (entity.url) addUpdate.url = entity.url
      if (entity._hash) addUpdate.hash = entity._hash
      if (entity.createdBlob) addUpdate.createdBlob = entity.createdBlob
      if (entity.metadata) addUpdate.metadata = entity.metadata
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
      const expandedUpdate = await this.queueUpdateForOutOfSyncContent(
        update,
        pathname,
        persistedContent,
        expectedContent
      )
      if (expandedUpdate != null) {
        // Adjust the ranges for the changes that have been made to the content
        for (const op of expandedUpdate.op) {
          if (isInsert(op)) {
            file.getComments().applyInsert(new Range(op.p, op.i.length))
            file.getTrackedChanges().applyInsert(op.p, op.i)
          } else if (isDelete(op)) {
            file.getComments().applyDelete(new Range(op.p, op.d.length))
            file.getTrackedChanges().applyDelete(op.p, op.d.length)
          }
        }
      }
    }

    const persistedComments = file.getComments().toArray()
    if (update.resyncDocContent.historyOTRanges) {
      this.queueUpdatesForOutOfSyncCommentsHistoryOT(
        update,
        pathname,
        file.getComments().toRaw()
      )
    } else {
      await this.queueUpdatesForOutOfSyncComments(
        update,
        pathname,
        persistedComments
      )
    }

    const persistedChanges = file.getTrackedChanges().asSorted()
    await this.queueUpdatesForOutOfSyncTrackedChanges(
      update,
      pathname,
      persistedChanges
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
      return null
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
    return expandedUpdate
  }

  /**
   * Queue updates for out of sync comments
   *
   * @param {ResyncDocContentUpdate} update
   * @param {string} pathname
   * @param {CommentRawData[]} persistedComments
   */
  queueUpdatesForOutOfSyncCommentsHistoryOT(
    update,
    pathname,
    persistedComments
  ) {
    const expectedComments =
      update.resyncDocContent.historyOTRanges?.comments ?? []
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
          doc: update.doc,
          op: [{ deleteComment: persistedComment.id }],
          meta: {
            pathname,
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
        persistedComment &&
        commentRangesAreInSyncHistoryOT(persistedComment, expectedComment)
      ) {
        if (expectedComment.resolved === persistedComment.resolved) {
          // Both comments are identical; do nothing
        } else {
          // Only the resolved state differs
          this.expandedUpdates.push({
            doc: update.doc,
            op: [
              {
                commentId: expectedComment.id,
                resolved: expectedComment.resolved,
              },
            ],
            meta: {
              pathname,
              resync: true,
              origin: this.origin,
              ts: update.meta.ts,
            },
          })
        }
      } else {
        // New comment or ranges differ
        this.expandedUpdates.push({
          doc: update.doc,
          op: [
            {
              commentId: expectedComment.id,
              ranges: expectedComment.ranges,
              resolved: expectedComment.resolved,
            },
          ],
          meta: {
            pathname,
            resync: true,
            origin: this.origin,
            ts: update.meta.ts,
          },
        })
      }
    }
  }

  /**
   * Queue updates for out of sync comments
   *
   * @param {ResyncDocContentUpdate} update
   * @param {string} pathname
   * @param {HistoryComment[]} persistedComments
   */
  async queueUpdatesForOutOfSyncComments(update, pathname, persistedComments) {
    const expectedContent = update.resyncDocContent.content
    const expectedComments = update.resyncDocContent.ranges?.comments ?? []
    const resolvedCommentIds = new Set(
      update.resyncDocContent.resolvedCommentIds ?? []
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
      const expectedCommentResolved = resolvedCommentIds.has(expectedComment.id)
      if (
        persistedComment != null &&
        commentRangesAreInSync(persistedComment, expectedComment)
      ) {
        if (expectedCommentResolved === persistedComment.resolved) {
          // Both comments are identical; do nothing
        } else {
          // Only the resolved state differs
          this.expandedUpdates.push({
            pathname,
            commentId: expectedComment.id,
            resolved: expectedCommentResolved,
            meta: {
              resync: true,
              origin: this.origin,
              ts: update.meta.ts,
            },
          })
        }
      } else {
        const op = { ...expectedComment.op, resolved: expectedCommentResolved }
        // New comment or ranges differ
        this.expandedUpdates.push({
          doc: update.doc,
          op: [op],
          meta: {
            resync: true,
            origin: this.origin,
            ts: update.meta.ts,
            pathname,
            doc_length: expectedContent.length,
          },
        })
      }
    }
  }

  /**
   * Queue updates for out of sync tracked changes
   *
   * @param {ResyncDocContentUpdate} update
   * @param {string} pathname
   * @param {readonly HistoryTrackedChange[]} persistedChanges
   */
  async queueUpdatesForOutOfSyncTrackedChanges(
    update,
    pathname,
    persistedChanges
  ) {
    const expectedChanges = update.resyncDocContent.ranges?.changes ?? []
    const expectedContent = update.resyncDocContent.content

    /**
     * A cursor on the expected content
     */
    let cursor = 0

    /**
     * The persisted tracking at cursor
     *
     * @type {TrackingDirective}
     */
    let persistedTracking = { type: 'none' }

    /**
     * The expected tracking at cursor
     *
     * @type {TrackingDirective}
     */
    let expectedTracking = { type: 'none' }

    /**
     * The retain ops for the update
     *
     * @type {RetainOp[]}
     */
    const ops = []

    /**
     * The retain op being built
     *
     * @type {RetainOp | null}
     */
    let currentOp = null

    for (const transition of getTrackedChangesTransitions(
      persistedChanges,
      expectedChanges,
      update.resyncDocContent.historyOTRanges?.trackedChanges || [],
      expectedContent.length
    )) {
      if (transition.pos > cursor) {
        // The next transition will move the cursor. Decide what to do with the interval.
        if (trackingDirectivesEqual(expectedTracking, persistedTracking)) {
          // Expected tracking and persisted tracking are in sync. Emit the
          // current op and skip this interval.
          if (currentOp != null) {
            ops.push(currentOp)
            currentOp = null
          }
        } else {
          // Expected tracking and persisted tracking are different.
          const retainedText = expectedContent.slice(cursor, transition.pos)
          if (
            currentOp?.tracking != null &&
            trackingDirectivesEqual(expectedTracking, currentOp.tracking)
          ) {
            // The current op has the right tracking. Extend it.
            currentOp.r += retainedText
          } else {
            // The current op doesn't have the right tracking. Emit the current
            // op and start a new one.
            if (currentOp != null) {
              ops.push(currentOp)
            }
            currentOp = {
              r: retainedText,
              p: cursor,
              tracking: expectedTracking,
            }
          }
        }

        // Advance cursor
        cursor = transition.pos
      }

      // Update the expected and persisted tracking
      if (transition.stage === 'persisted') {
        persistedTracking = transition.tracking
      } else {
        expectedTracking = transition.tracking
      }
    }

    // Emit the last op
    if (currentOp != null) {
      ops.push(currentOp)
    }

    if (ops.length > 0) {
      this.expandedUpdates.push({
        doc: update.doc,
        op: ops,
        meta: {
          resync: true,
          origin: this.origin,
          ts: update.meta.ts,
          pathname,
          doc_length: expectedContent.length,
        },
      })
    }
  }
}

/**
 * Compares the ranges in the persisted and expected comments
 *
 * @param {CommentRawData} persistedComment
 * @param {CommentRawData} expectedComment
 */
function commentRangesAreInSyncHistoryOT(persistedComment, expectedComment) {
  if (persistedComment.ranges.length !== expectedComment.ranges.length) {
    return false
  }
  for (let i = 0; i < persistedComment.ranges.length; i++) {
    const persistedRange = persistedComment.ranges[i]
    const expectedRange = expectedComment.ranges[i]
    if (persistedRange.pos !== expectedRange.pos) return false
    if (persistedRange.length !== expectedRange.length) return false
  }
  return true
}

/**
 * Compares the ranges in the persisted and expected comments
 *
 * @param {HistoryComment} persistedComment
 * @param {Comment} expectedComment
 */
function commentRangesAreInSync(persistedComment, expectedComment) {
  const expectedPos = expectedComment.op.hpos ?? expectedComment.op.p
  const expectedLength = expectedComment.op.hlen ?? expectedComment.op.c.length
  if (expectedLength === 0) {
    // A zero length comment from RangesManager is a detached comment in history
    return persistedComment.ranges.length === 0
  }

  if (persistedComment.ranges.length !== 1) {
    // The editor only supports single range comments
    return false
  }
  const persistedRange = persistedComment.ranges[0]
  return (
    persistedRange.pos === expectedPos &&
    persistedRange.length === expectedLength
  )
}

/**
 * Iterates through expected tracked changes and persisted tracked changes and
 * returns all transitions, sorted by position.
 *
 * @param {readonly HistoryTrackedChange[]} persistedChanges
 * @param {TrackedChange[]} expectedChanges
 * @param {TrackedChangeRawData[]} persistedChangesHistoryOT
 * @param {number} docLength
 */
function getTrackedChangesTransitions(
  persistedChanges,
  expectedChanges,
  persistedChangesHistoryOT,
  docLength
) {
  /** @type {TrackedChangeTransition[]} */
  const transitions = []

  for (const change of persistedChanges) {
    transitions.push({
      stage: 'persisted',
      pos: change.range.start,
      tracking: {
        type: change.tracking.type,
        userId: change.tracking.userId,
        ts: change.tracking.ts.toISOString(),
      },
    })
    transitions.push({
      stage: 'persisted',
      pos: change.range.end,
      tracking: { type: 'none' },
    })
  }

  for (const change of persistedChangesHistoryOT) {
    transitions.push({
      stage: 'expected',
      pos: change.range.pos,
      tracking: change.tracking,
    })
    transitions.push({
      stage: 'expected',
      pos: change.range.pos + change.range.length,
      tracking: { type: 'none' },
    })
  }

  for (const change of expectedChanges) {
    const op = change.op
    const pos = op.hpos ?? op.p
    if (isInsert(op)) {
      transitions.push({
        stage: 'expected',
        pos,
        tracking: {
          type: 'insert',
          userId: change.metadata.user_id,
          ts: change.metadata.ts,
        },
      })
      transitions.push({
        stage: 'expected',
        pos: pos + op.i.length,
        tracking: { type: 'none' },
      })
    } else {
      transitions.push({
        stage: 'expected',
        pos,
        tracking: {
          type: 'delete',
          userId: change.metadata.user_id,
          ts: change.metadata.ts,
        },
      })
      transitions.push({
        stage: 'expected',
        pos: pos + op.d.length,
        tracking: { type: 'none' },
      })
    }
  }

  transitions.push({
    stage: 'expected',
    pos: docLength,
    tracking: { type: 'none' },
  })

  transitions.sort((a, b) => {
    if (a.pos < b.pos) {
      return -1
    } else if (a.pos > b.pos) {
      return 1
    } else if (a.tracking.type === 'none' && b.tracking.type !== 'none') {
      // none type comes before other types so that it can be overridden at the
      // same position
      return -1
    } else if (a.tracking.type !== 'none' && b.tracking.type === 'none') {
      // none type comes before other types so that it can be overridden at the
      // same position
      return 1
    } else {
      return 0
    }
  })

  return transitions
}

/**
 * Returns true if both tracking directives are equal
 *
 * @param {TrackingDirective} a
 * @param {TrackingDirective} b
 */
function trackingDirectivesEqual(a, b) {
  if (a.type === 'none') {
    return b.type === 'none'
  } else {
    return a.type === b.type && a.userId === b.userId && a.ts === b.ts
  }
}

// EXPORTS

const startResyncCb = callbackify(startResync)
const startResyncWithoutLockCb = callbackify(startResyncWithoutLock)
const startHardResyncCb = callbackify(startHardResync)
const setResyncStateCb = callbackify(setResyncState)
const clearResyncStateCb = callbackify(clearResyncState)
const skipUpdatesDuringSyncCb = callbackifyMultiResult(skipUpdatesDuringSync, [
  'updates',
  'syncState',
])

/**
 * @param {string} projectId
 * @param {string} projectHistoryId
 * @param {{chunk: import('overleaf-editor-core/lib/types.js').RawChunk}} mostRecentChunk
 * @param {Array<Update>} updates
 * @param {() => void} extendLock
 * @param {(err: Error | null, updates?: Array<Update>) => void} callback
 */
const expandSyncUpdatesCb = (
  projectId,
  projectHistoryId,
  mostRecentChunk,
  updates,
  extendLock,
  callback
) => {
  const extendLockPromises = promisify(extendLock)
  expandSyncUpdates(
    projectId,
    projectHistoryId,
    mostRecentChunk,
    updates,
    extendLockPromises
  )
    .then(result => {
      callback(null, result)
    })
    .catch(err => {
      callback(err)
    })
}

export {
  startResyncCb as startResync,
  startResyncWithoutLockCb as startResyncWithoutLock,
  startHardResyncCb as startHardResync,
  setResyncStateCb as setResyncState,
  clearResyncStateCb as clearResyncState,
  skipUpdatesDuringSyncCb as skipUpdatesDuringSync,
  expandSyncUpdatesCb as expandSyncUpdates,
}

export const promises = {
  startResync,
  startResyncWithoutLock,
  startHardResync,
  setResyncState,
  clearResyncState,
  clearResyncStateIfAllAfter,
  skipUpdatesDuringSync,
  expandSyncUpdates,
}

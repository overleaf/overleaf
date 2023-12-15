import _ from 'lodash'
import async from 'async'
import { promisify } from 'util'
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

const MAX_RESYNC_HISTORY_RECORDS = 100 // keep this many records of previous resyncs
const EXPIRE_RESYNC_HISTORY_INTERVAL_MS = 90 * 24 * 3600 * 1000 // 90 days

const keys = Settings.redis.lock.key_schema

// db.projectHistorySyncState.ensureIndex({expiresAt: 1}, {expireAfterSeconds: 0, background: true})
// To add expiresAt field to existing entries in collection (choose a suitable future expiry date):
// db.projectHistorySyncState.updateMany({resyncProjectStructure: false, resyncDocContents: [], expiresAt: {$exists:false}}, {$set: {expiresAt: new Date("2019-07-01")}})

export function startResync(projectId, options, callback) {
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
  if (typeof options === 'function') {
    callback = options
    options = {}
  }

  Metrics.inc('project_history_resync')
  LockManager.runWithLock(
    keys.projectHistoryLock({ project_id: projectId }),
    (extendLock, releaseLock) =>
      _startResyncWithoutLock(projectId, options, releaseLock),
    function (error) {
      if (error) {
        OError.tag(error)
        // record error in starting sync ("sync ongoing")
        ErrorRecorder.record(projectId, -1, error, () => callback(error))
      } else {
        callback()
      }
    }
  )
}

export function startHardResync(projectId, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }

  Metrics.inc('project_history_hard_resync')
  LockManager.runWithLock(
    keys.projectHistoryLock({ project_id: projectId }),
    (extendLock, releaseLock) =>
      clearResyncState(projectId, function (err) {
        if (err) {
          return releaseLock(OError.tag(err))
        }
        RedisManager.clearFirstOpTimestamp(projectId, function (err) {
          if (err) {
            return releaseLock(OError.tag(err))
          }
          RedisManager.destroyDocUpdatesQueue(projectId, function (err) {
            if (err) {
              return releaseLock(OError.tag(err))
            }
            _startResyncWithoutLock(projectId, options, releaseLock)
          })
        })
      }),
    function (error) {
      if (error) {
        OError.tag(error)
        // record error in starting sync ("sync ongoing")
        ErrorRecorder.record(projectId, -1, error, () => callback(error))
      } else {
        callback()
      }
    }
  )
}

function _startResyncWithoutLock(projectId, options, callback) {
  ErrorRecorder.recordSyncStart(projectId, function (error) {
    if (error) {
      return callback(OError.tag(error))
    }

    _getResyncState(projectId, function (error, syncState) {
      if (error) {
        return callback(OError.tag(error))
      }

      if (syncState.isSyncOngoing()) {
        return callback(new OError('sync ongoing'))
      }

      syncState.setOrigin(options.origin || { kind: 'history-resync' })
      syncState.startProjectStructureSync()

      WebApiManager.requestResync(projectId, function (error) {
        if (error) {
          return callback(OError.tag(error))
        }

        setResyncState(projectId, syncState, callback)
      })
    })
  })
}

function _getResyncState(projectId, callback) {
  db.projectHistorySyncState.findOne(
    {
      project_id: new ObjectId(projectId.toString()),
    },
    function (error, rawSyncState) {
      if (error) {
        return callback(OError.tag(error))
      }
      const syncState = SyncState.fromRaw(projectId, rawSyncState)
      callback(null, syncState)
    }
  )
}

export function setResyncState(projectId, syncState, callback) {
  if (syncState == null) {
    return callback()
  } // skip if syncState is null (i.e. unchanged)
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
    // starting a new sync
    update.$inc = { resyncCount: 1 }
    update.$unset = { expiresAt: true } // prevent the entry expiring while sync is in ongoing
  } else {
    // successful completion of existing sync
    update.$set.expiresAt = new Date(
      Date.now() + EXPIRE_RESYNC_HISTORY_INTERVAL_MS
    ) // set the entry to expire in the future
  }
  // apply the update
  db.projectHistorySyncState.updateOne(
    {
      project_id: new ObjectId(projectId),
    },
    update,
    {
      upsert: true,
    },
    callback
  )
}

export function clearResyncState(projectId, callback) {
  db.projectHistorySyncState.deleteOne(
    {
      project_id: new ObjectId(projectId.toString()),
    },
    callback
  )
}

export function skipUpdatesDuringSync(projectId, updates, callback) {
  _getResyncState(projectId, function (error, syncState) {
    if (error) {
      return callback(OError.tag(error))
    }

    if (!syncState.isSyncOngoing()) {
      logger.debug({ projectId }, 'not skipping updates: no resync in progress')
      return callback(null, updates) // don't return synsState when unchanged
    }

    const filteredUpdates = []

    for (const update of updates) {
      try {
        syncState.updateState(update)
      } catch (error1) {
        error = OError.tag(error1)
        if (error instanceof SyncError) {
          return callback(error)
        } else {
          throw error
        }
      }

      const shouldSkipUpdate = syncState.shouldSkipUpdate(update)
      if (!shouldSkipUpdate) {
        filteredUpdates.push(update)
      } else {
        logger.debug({ projectId, update }, 'skipping update due to resync')
      }
    }

    callback(null, filteredUpdates, syncState)
  })
}

export function expandSyncUpdates(
  projectId,
  projectHistoryId,
  updates,
  extendLock,
  callback
) {
  const areSyncUpdatesQueued =
    _.some(updates, 'resyncProjectStructure') ||
    _.some(updates, 'resyncDocContent')
  if (!areSyncUpdatesQueued) {
    logger.debug({ projectId }, 'no resync updates to expand')
    return callback(null, updates)
  }

  _getResyncState(projectId, (error, syncState) => {
    if (error) {
      return callback(OError.tag(error))
    }

    // compute the current snapshot from the most recent chunk
    SnapshotManager.getLatestSnapshot(
      projectId,
      projectHistoryId,
      (error, snapshotFiles) => {
        if (error) {
          return callback(OError.tag(error))
        }
        // check if snapshot files are valid
        const invalidFiles = _.pickBy(
          snapshotFiles,
          (v, k) => v == null || typeof v.isEditable !== 'function'
        )
        if (_.size(invalidFiles) > 0) {
          return callback(
            new SyncError('file is missing isEditable method', {
              projectId,
              invalidFiles,
            })
          )
        }
        const expander = new SyncUpdateExpander(
          projectId,
          snapshotFiles,
          syncState.origin
        )
        // expand updates asynchronously to avoid blocking
        const handleUpdate = (
          update,
          cb // n.b. lock manager calls cb asynchronously
        ) =>
          expander.expandUpdate(update, error => {
            if (error) {
              return cb(OError.tag(error))
            }
            extendLock(cb)
          })
        async.eachSeries(updates, handleUpdate, error => {
          if (error) {
            return callback(OError.tag(error))
          }
          callback(null, expander.getExpandedUpdates())
        })
      }
    )
  })
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

  expandUpdate(update, cb) {
    if (update.resyncProjectStructure != null) {
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
      cb()
    } else if (update.resyncDocContent != null) {
      logger.debug(
        { projectId: this.projectId, update },
        'expanding resyncDocContent update'
      )
      this.queueTextOpForOutOfSyncContents(update, cb)
    } else {
      this.expandedUpdates.push(update)
      cb()
    }
  }

  getExpandedUpdates() {
    return this.expandedUpdates
  }

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

      if (entity.doc != null) {
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

  queueTextOpForOutOfSyncContents(update, cb) {
    const pathname = UpdateTranslator._convertPathname(update.path)
    const snapshotFile = this.files[pathname]
    const expectedFile = update.resyncDocContent

    if (!snapshotFile) {
      return cb(new OError('unrecognised file: not in snapshot'))
    }

    // Compare hashes to see if the persisted file matches the expected content.
    // The hash of the persisted files is stored in the snapshot.
    // Note getHash() returns the hash only when the persisted file has
    // no changes in the snapshot, the hash is null if there are changes
    // that apply to it.
    const persistedHash =
      typeof snapshotFile.getHash === 'function'
        ? snapshotFile.getHash()
        : undefined
    if (persistedHash != null) {
      const expectedHash = HashManager._getBlobHashFromString(
        expectedFile.content
      )
      if (persistedHash === expectedHash) {
        logger.debug(
          { projectId: this.projectId, persistedHash, expectedHash },
          'skipping diff because hashes match and persisted file has no ops'
        )
        return cb()
      }
    } else {
      logger.debug('cannot compare hashes, will retrieve content')
    }

    const expectedContent = update.resyncDocContent.content

    const computeDiff = (persistedContent, cb) => {
      let op
      logger.debug(
        { projectId: this.projectId, persistedContent, expectedContent },
        'diffing doc contents'
      )
      try {
        op = UpdateCompressor.diffAsShareJsOps(
          persistedContent,
          expectedContent
        )
      } catch (error) {
        return cb(
          OError.tag(error, 'error from diffAsShareJsOps', {
            projectId: this.projectId,
            persistedContent,
            expectedContent,
          })
        )
      }
      if (op.length === 0) {
        return cb()
      }
      update = {
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
      this.expandedUpdates.push(update)
      Metrics.inc('project_history_resync_operation', 1, {
        status: 'update text file contents',
      })
      cb()
    }

    // compute the difference between the expected and persisted content
    if (snapshotFile.load != null) {
      WebApiManager.getHistoryId(this.projectId, (err, historyId) => {
        if (err) {
          return cb(OError.tag(err))
        }
        const loadFile = snapshotFile.load(
          'eager',
          HistoryStoreManager.getBlobStore(historyId)
        )
        loadFile
          .then(file => computeDiff(file.getContent(), cb))
          .catch(err => cb(err)) // error loading file or computing diff
      })
    } else if (snapshotFile.content != null) {
      // use dummy content from queueAddOpsForMissingFiles for added missing files
      computeDiff(snapshotFile.content, cb)
    } else {
      cb(new OError('unrecognised file'))
    }
  }
}

export const promises = {
  startResync: promisify(startResync),
  startHardResync: promisify(startHardResync),
  setResyncState: promisify(setResyncState),
  clearResyncState: promisify(clearResyncState),
  skipUpdatesDuringSync: promisify(skipUpdatesDuringSync),
  expandSyncUpdates: promisify(expandSyncUpdates),
}

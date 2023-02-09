const _ = require('lodash')
const settings = require('@overleaf/settings')
const OError = require('@overleaf/o-error')
const fs = require('fs')
const fse = require('fs-extra')
const { ObjectId } = require('mongodb')
const request = require('request')
const { pipeline } = require('stream')
const unzipper = require('unzipper')
const util = require('util')
const logger = require('@overleaf/logger')
const path = require('path')
const {
  FileTooLargeError,
  InvalidNameError,
} = require('../../../../app/src/Features/Errors/Errors')
const FilestoreHandler = require('../../../../app/src/Features/FileStore/FileStoreHandler')
const ProjectGetter = require('../../../../app/src/Features/Project/ProjectGetter')
const RedisWrapper = require('../../../../app/src/infrastructure/RedisWrapper')
const HistoryManager = require('../../../../app/src/Features/History/HistoryManager')
const ProjectHistoryHandler = require('../../../../app/src/Features/Project/ProjectHistoryHandler')
const ProjectUpdateHandler = require('../../../../app/src/Features/Project/ProjectUpdateHandler')
const DocumentUpdaterHandler = require('../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler')
const ProjectEntityHandler = require('../../../../app/src/Features/Project/ProjectEntityHandler')
const ProjectEntityUpdateHandler = require('../../../../app/src/Features/Project/ProjectEntityUpdateHandler')
const SafePath = require('../../../../app/src/Features/Project/SafePath')
const { DeletedFile } = require('../../../../app/src/models/DeletedFile')
const { Doc } = require('../../../../app/src/models/Doc')
const {
  iterablePaths,
} = require('../../../../app/src/Features/Project/IterablePath')

const rclient = RedisWrapper.client('project_history_migration')

module.exports = { deleteProjectHistory, migrateProjectHistory }

/**
 * @typedef {Object} UpdateMeta
 * @property {string | null} user_id the id of the user that performed the update
 * @property {number} ts the timestamp of the update
 */

/**
 * @typedef {UpdateMeta} EditDocUpdateMeta
 * @property {string | null} user_id
 * @property {number} ts
 * @property {string} pathname the doc pathname
 * @property {number} doc_length the length of the doc
 */

/**
 * @typedef {Object} Update
 * @property {string} pathname the path in the file tree
 * @property {UpdateMeta} meta
 // * @property {string} version a two-part version. The first part is the project version after the updates, as recorded in Mongo. The second part is a counter that increments for each update in this batch.
 * @property {string} projectHistoryId the v1 history id for this project
 * @property {number} v
 */

/**
 * @typedef {Update} FileUpdate
 * @property {string} pathname
 * @property {UpdateMeta} meta
 * @property {string} projectHistoryId
 * @property {number} v
 * @property {string} file
 */

/**
 * @typedef {FileUpdate} AddFileUpdate
 * @property {string} pathname
 * @property {UpdateMeta} meta
 * @property {string} projectHistoryId
 * @property {number} v
 * @property {string} file
 * @property {string} url
 */

/**
 * @typedef {Update} DocUpdate
 * @property {UpdateMeta} meta
 * @property {string} projectHistoryId
 * @property {number} v
 * @property {string} doc
 */

/**
 * @typedef {DocUpdate} AddDocUpdate
 * @property {string} pathname
 * @property {UpdateMeta} meta
 * @property {string} projectHistoryId
 * @property {number} v
 * @property {string} doc
 * @property {string} docLines
 * @property {string} docLinesId
 * @property {boolean} contentStored
 */

/**
 * @typedef {DocUpdate} EditDocUpdate
 * @property {EditDocUpdateMeta} meta
 * @property {string} projectHistoryId
 * @property {number} v
 * @property {number} lastV
 * @property {string} doc
 * @property {Array<Object>} op
 */

/**
 * @typedef {AddDocUpdate | AddFileUpdate} AddUpdate
 */

/**
 * @typedef {DocUpdate | FileUpdate} DeleteUpdate
 * @property {string} pathname
 * @property {UpdateMeta} meta
 * @property {string} projectHistoryId
 * @property {number} v
 * @property {string} doc
 * @property {string} new_pathname
 */

/**
 * @typedef {Update} EditDocUpdateStub
 * @property {true} stub
 * @property {string} path
 * @property {string} pathname
 * @property {number} v
 * @property {number} doc_length
 */

/**
 * @typedef {AddUpdate | DeleteUpdate | EditDocUpdate | EditDocUpdateStub } AnyUpdate
 */

/**
 * @typedef {Object} Project
 * @property {string} _id the id of the user that performed the update
 * @property {Object} overleaf
 */

/**
 * @typedef ManifestUpdate
 * @property {string} path
 * @property {number} doc_length
 * @property {number} ts
 * @property {number} version
 */

/**
 * @typedef ManifestContent
 * @property {number} start
 */

/**
 * @typedef ManifestDoc
 * @property {string} id
 * @property {ManifestContent} content
 * @property {Array<ManifestUpdate>} updates
 */

/**
 * @typedef {Object} Manifest
 * @property {string} projectId
 * @property {Array<ManifestDoc>} docs
 */

/**
 * @typedef Entity
 * @property {string} type
 * @property {string} path
 * @property {string} docLines
 * @property {string} deletedAt
 * @property {boolean} deleted
 */

/**
 * Iterate recursively through the folders in project.rootFolder,
 * building a map of all the docs (with content as a docLines string)
 * and files (with content as a filestore URL).
 *
 * @param {Object} project
 * @returns {Promise<Map<string, Entity>>}
 */
async function processRootFolder(project) {
  const entities = new Map()

  async function processFolder(folder, root = '') {
    for (const item of iterablePaths(folder, 'docs')) {
      const doc = await Doc.findOne(
        item._id,
        // only read the fields we need to save memory
        { _id: 1, inS3: 1, lines: 1, name: 1 }
      ).lean()

      // skip malformed doc entries
      if (!doc?._id) {
        logger.warn({ doc }, 'skipping doc with missing id')
        continue
      }
      const id = doc._id.toString()
      const docIsInS3 = !!doc.inS3
      let docLines

      if (docIsInS3) {
        const docPeek = await ProjectEntityHandler.promises.getDoc(
          project._id,
          item._id,
          { peek: true }
        )
        docLines = docPeek.lines
      } else {
        docLines = doc.lines
      }

      if (!docLines) {
        throw new Error(`no doc lines for doc ${id} (inS3: ${docIsInS3})`)
      }

      entities.set(id, {
        path: `${root}/${item.name}`, // NOTE: not doc.name, which is "new doc",
        type: 'doc',
        docLines: docLines.join('\n'),
      })
    }

    for (const item of iterablePaths(folder, 'fileRefs')) {
      const path = `${root}/${item.name}`

      // skip malformed file entries
      if (!item?._id) {
        logger.warn({ item }, 'skipping fileRef with missing id')
        continue
      }
      const id = item._id.toString()

      entities.set(id, {
        path,
        type: 'file',
        url: FilestoreHandler._buildUrl(project._id.toString(), id),
      })
    }

    for (const subfolder of iterablePaths(folder, 'folders')) {
      const path = `${root}/${subfolder.name}`
      await processFolder(subfolder, path)
    }
  }

  for (const folder of project.rootFolder) {
    await processFolder(folder)
  }

  return entities
}

/**
 * Read docs deleted from a project, from the Doc collection,
 * and add them to the entities map with the content in a docLines string.
 *
 * These entities have a `deleted` property set to `true` and a `deletedAt` date.
 *
 * @param {Map<string, Object>} entities
 * @param {string} projectId
 * @returns {Promise<void>}
 */
async function readDeletedDocs(entities, projectId) {
  // NOTE: could call DocstoreManager.promises.getAllDeletedDocs(projectId) instead

  // Look for all docs, since some deleted docs are found in track-changes manifest,
  // but do not have deleted flag set for reasons that are unclear
  // (we will not add docs to entities if they were previously added by processRootFolder)
  const deletedDocsCursor = Doc.find(
    {
      project_id: ObjectId(projectId),
    },
    // only read the fields we need to save memory
    { _id: 1, inS3: 1, lines: 1, name: 1, deletedAt: 1 }
  )
    .lean()
    .cursor()
  for await (const doc of deletedDocsCursor) {
    // skip malformed deleted doc entries
    if (!doc?._id) {
      logger.warn({ doc }, 'skipping deleted doc with missing id')
      continue
    }
    const id = doc._id.toString()
    // Skip doc if we already have an entry in entities
    if (!entities.has(id)) {
      const docIsInS3 = !!doc.inS3
      let docLines

      if (docIsInS3) {
        const docPeek = await ProjectEntityHandler.promises.getDoc(
          ObjectId(projectId),
          doc._id,
          { peek: true }
        )
        docLines = docPeek.lines
      } else {
        docLines = doc.lines
      }

      if (!docLines) {
        throw new Error(`no doc lines for doc ${id} (inS3: ${docIsInS3})`)
      }

      // const ts = Number(
      //   doc.deletedAt ? new Date(doc.deletedAt) : Date.now()
      // )

      if (doc.name && !SafePath.isCleanFilename(doc.name)) {
        const newName = SafePath.clean(doc.name)
        logger.warn(
          { projectId, docId: id, origName: doc.name, newName },
          'renaming invalid deleted file'
        )
        doc.name = newName
      }

      entities.set(id, {
        // NOTE: adding the doc id to the file path to avoid collisions
        path: `/_deleted/${id}/${doc.name}`,
        name: doc.name || 'unnamed', // fallback for improperly deleted docs
        deleted: true,
        type: 'doc',
        deletedAt: doc.deletedAt,
        docLines: docLines.join('\n'),
      })
    }
  }
}

/**
 * Read files deleted from a project, from the DeletedFile collection,
 * and add them to the entities map.
 *
 * These entities have a `deleted` property set to `true` and a `deletedAt` date.
 * The url is built later, from the project id and file id.
 *
 * @param {Map<string, Object>} entities
 * @param {string} projectId
 * @returns {Promise<void>}
 */
async function readDeletedFiles(entities, projectId) {
  const deletedFilesCursor = DeletedFile.find(
    {
      projectId: ObjectId(projectId),
    },
    // only read the fields we need to save memory
    { _id: 1, name: 1, deletedAt: 1 }
  )
    .lean()
    .cursor()

  for await (const file of deletedFilesCursor) {
    // skip malformed deleted file entries
    if (!file?._id) {
      logger.warn({ file }, 'skipping deleted file with missing id')
      continue
    }
    const id = file._id.toString()
    // TODO: check if it already exists?
    if (!entities.has(id)) {
      // const ts = Number(
      //   file.deletedAt ? new Date(file.deletedAt) : Date.now()
      // )

      // TODO: would the hash be useful here?

      if (file.name && !SafePath.isCleanFilename(file.name)) {
        const newName = SafePath.clean(file.name)
        logger.warn(
          { projectId, fileId: id, origName: file.name, newName },
          'renaming invalid deleted file'
        )
        file.name = newName
      }

      entities.set(id, {
        // NOTE: adding the doc id to the file path to avoid collisions
        path: `/_deleted/${id}/${file.name}`,
        name: file.name,
        deleted: true,
        type: 'file',
        deletedAt: file.deletedAt,
      })
    }
  }
}

/**
 * Iterate through the sorted array of updates, pushing each one to Redis.
 *
 * In batches, tell project-history to pull the updates from Redis and process them,
 * so the process fails early if something can't be processed.
 *
 * @param {Array<AnyUpdate>} updates
 * @param {string} projectId
 * @param {string} projectHistoryId
 * @param {Map.<string, Object>} fileMap
 * @returns {Promise<void>}
 */
async function sendUpdatesToProjectHistory(
  updates,
  projectId,
  projectHistoryId,
  fileMap
) {
  let multi = rclient.multi()
  let counter = 0
  let processed = 0
  let size = 0

  const projectHistoryKey =
    settings.redis.project_history_migration.key_schema.projectHistoryOps({
      projectId,
    })

  // clear out anything in the Redis queue for this project's history
  multi.del(projectHistoryKey)

  for (let update of updates) {
    // read the content for each update stub from the archive
    if (update.stub) {
      update = await buildEditDocUpdate(projectHistoryId, update, fileMap)
    }

    // non-edit doc updates need string timestamps, not numbers
    if (!('op' in update)) {
      update.meta.ts = new Date(update.meta.ts).toISOString()
    }

    const updateJSON = JSON.stringify(update)
    multi.rpush(projectHistoryKey, updateJSON)
    counter++
    processed++
    size += updateJSON.length

    // flush the history after every 1000 updates and start a new transaction
    if (counter === 1000) {
      logger.debug(
        { processed, total: updates.length },
        'sending updates to project history'
      )
      // execute the transaction
      await util.promisify(multi.exec)()
      // tell project-history to pull the updates from the Redis queue
      await HistoryManager.promises.flushProject(projectId) // TODO: roll back if this fails?
      counter = 0
      size = 0
      multi = rclient.multi()
    } else if (size > 1024 * 1024) {
      // queue entries in redis more frequently to reduce memory usage
      await util.promisify(multi.exec)()
      size = 0
      multi = rclient.multi()
    }
  }

  if (counter > 0) {
    // execute the transaction
    await util.promisify(multi.exec)()
    // tell project-history to pull the updates from the Redis queue
    await HistoryManager.promises.flushProject(projectId) // TODO: roll back if this fails?
  }

  // return the queue length so we can check that it is empty
  const queueLength = await rclient.llen(projectHistoryKey)
  return queueLength
}

/**
 * Compare two arrays of updates, with the earliest timestamp at the end first.
 *
 * @param {Array<AnyUpdate>} a
 * @param {Array<AnyUpdate>} b
 * @returns {number}
 */
function earliestTimestampFirst(a, b) {
  // both arrays are empty, leave them
  if (!a.length && !b.length) {
    return 0
  }

  // a is empty, move b before a
  if (!a.length) {
    return 1
  }

  // b is empty, don't move b before a
  if (!b.length) {
    return -1
  }

  const tsB = b[b.length - 1].meta.ts
  const tsA = a[a.length - 1].meta.ts
  // if the last item in b has a lower timestamp that the last item in a, move b above a
  if (tsB < tsA) {
    return 1
  }
  if (tsB > tsA) {
    return -1
  }
  // use pathnames as secondary sort key, to make order deterministic for
  // updates with the same timestamp
  const pathnameB = b[b.length - 1].pathname
  const pathnameA = a[a.length - 1].pathname
  if (pathnameB < pathnameA) {
    return 1
  }
  if (pathnameB > pathnameA) {
    return -1
  }
  return 0 // shouldn't happen, because pathnames must be distinct
}

/**
 * Compare two updates, with the highest version number first
 *
 * @param {AnyUpdate} a
 * @param {AnyUpdate} b
 * @returns {number}
 */
function decreasingDocVersion(a, b) {
  if (b.v === a.v) {
    throw new Error(`Matching version: ${b.v} ${a.v}`)
    // return 0
  }
  // if b.v is greater than a.v, sort b above a
  return b.v > a.v ? 1 : -1
}

/**
 * Create an array of queued updates for each doc/file, sorted by version
 *
 * @param {Array<AnyUpdate>} updates
 * @returns {Promise<Array<AnyUpdate>>}
 */
async function sortUpdatesByQueue(updates) {
  // build a queue of updates for each doc/file
  const queues = {}

  for (const update of updates) {
    const docId = update.doc || update.file

    if (!(docId in queues)) {
      queues[docId] = []
    }

    queues[docId].push(update)
  }

  // convert the map to an array of queues
  const values = Object.values(queues)

  for (const queue of values) {
    // sort each queue in place, with each update in decreasing version ofder
    queue.sort(decreasingDocVersion)
  }

  return values
}

/**
 * Fetch all the content and updates for this project from track-changes, as a zip archive.
 *
 * @param {string} projectId
 * @param {string} tempFilePath
 * @returns
 */
async function fetchTrackChangesArchive(projectId, tempFilePath) {
  const writeStream = fs.createWriteStream(tempFilePath)

  const url = `${settings.apis.trackchanges.url}/project/${projectId}/zip`

  // exposed for debugging during full-project-history migration
  const timeout =
    parseInt(process.env.FETCH_TRACK_CHANGES_TIMEOUT, 10) || 2 * 60 * 1000

  try {
    await util.promisify(pipeline)(request(url, { timeout }), writeStream)
  } catch (err) {
    logger.error({ err }, 'Error fetching track changes archive')
    throw err
  }

  const { size } = await fs.promises.stat(tempFilePath)
  logger.info({ projectId, size }, 'fetched zip file from track-changes')
}

/**
 * Open the zip archive and build a Map of each entry in the archive, with the path as the key
 *
 * @param {string} filePath
 * @returns {Promise<Map<string, Object>>}
 */

async function openTrackChangesArchive(filePath) {
  const directory = await unzipper.Open.file(filePath)
  return new Map(directory.files.map(file => [file.path, file]))
}

/**
 * Read the manifest data from the zip archive
 *
 * @param {Map<string, Object>} fileMap
 * @returns {Promise<Manifest>}
 */
async function readTrackChangesManifest(fileMap) {
  const manifestBuffer = await fileMap.get('manifest.json').buffer()

  return JSON.parse(manifestBuffer.toString())
}

/**
 * Check that entities conform to the pathnames allowed by project history
 *
 * @param {Map<string, Object>} entities
 * @param {string} projectId
 */
function validatePaths(entities, projectId) {
  const pathErrors = []
  for (const [id, entity] of entities) {
    if (!SafePath.isCleanPath(entity.path)) {
      pathErrors.push(
        `${entity.type}:${id}${entity.deleted ? ' (deleted)' : ''} path:${
          entity.path
        }`
      )
    }
  }
  if (pathErrors.length) {
    throw new OError('Invalid path in history migration', {
      projectId,
      pathErrors,
    })
  }
}

/**
 * Build an "add" update for an entity, with docLines or url set for the content.
 * This represents a doc or file being added to a project.
 *
 * @param {Object} entity
 * @param {string} entityId
 * @param {string} projectId
 * @param {string} projectHistoryId
 *
 * @returns {AddDocUpdate | AddFileUpdate}
 */
function buildAddUpdate(entity, entityId, projectId, projectHistoryId) {
  const ts = new ObjectId(entityId).getTimestamp()

  const update = {
    pathname: entity.path,
    v: 0, // NOTE: only for sorting
    meta: {
      // source?
      user_id: null, // TODO: assign the update to a system user?
      ts: Number(ts),
      origin: { kind: 'history-migration' },
    },
    projectHistoryId,
  }

  switch (entity.type) {
    case 'doc': {
      return {
        doc: entityId,
        ...update,
        docLines: entity.docLines,
      }
    }

    case 'file': {
      // TODO: set a hash here?
      return {
        // type: 'external',
        file: entityId,
        ...update,
        url: FilestoreHandler._buildUrl(projectId, entityId),
      }
    }

    default:
      throw new Error('Unknown entity type')
  }
}

/**
 * Build a "delete" update for an entity, with new_pathname set to an empty string.
 * This represents a doc or file being deleted from a project.
 *
 * @param {Object} entity
 * @param {string} entityId
 * @param {string} projectId
 * @param {string} projectHistoryId
 * @returns DeleteUpdate
 */
function buildDeleteUpdate(entity, entityId, projectId, projectHistoryId) {
  const ts = entity.deletedAt || new Date()

  const update = {
    pathname: entity.path,
    new_pathname: '', // empty path = deletion
    v: Infinity, // NOTE: only for sorting
    meta: {
      user_id: null, // TODO: assign this to a system user?
      ts: Number(ts),
      origin: { kind: 'history-migration' },
    },
    projectHistoryId,
  }

  switch (entity.type) {
    case 'doc':
      return {
        doc: entityId,
        ...update,
      }

    case 'file':
      return {
        file: entityId,
        ...update,
      }

    default:
      throw new Error(`Unknown entity type ${entity.type}`)
  }
}

/**
 * @typedef TrackedDocUpdateMeta
 * @property {string} user_id
 * @property {number} start_ts
 */

/**
 * @typedef TrackedDocUpdate
 * @property {string} doc_id
 * @property {Array<Object>} op
 * @property {number} v
 * @property {TrackedDocUpdateMeta} meta
 */

/**
 * Build an "edit" update, with op set to an array of operations from track-changes.
 *
 * This represents the contents of a doc being edited in a project.
 *
 * @param {string} projectHistoryId
 * @param {EditDocUpdateStub} updateStub
 * @param {Map.<string, Object>} fileMap
 *
 * @returns {Promise<EditDocUpdate>}
 */
async function buildEditDocUpdate(projectHistoryId, updateStub, fileMap) {
  const buffer = await fileMap.get(updateStub.path).buffer()

  /**
   * @type TrackedDocUpdate
   */
  const data = JSON.parse(buffer.toString())
  let userId = data.meta.user_id
  if (userId === 'anonymous-user' || userId === 'null') {
    userId = null
  }
  if (userId != null && !/^[0-9a-f]{24}$/.test(userId)) {
    throw new OError('Bad user id in ShareLaTeX history edit update', {
      userId,
    })
  }

  return {
    doc: data.doc_id,
    op: data.op, // NOTE: this is an array of operations
    v: data.v,
    lastV: data.v - 1,
    meta: {
      user_id: userId,
      ts: data.meta.start_ts, // TODO: use data.meta.end_ts or update.ts?
      pathname: updateStub.pathname,
      doc_length: updateStub.doc_length,
      origin: { kind: 'history-migration' },
    },
    projectHistoryId,
  }
}

/**
 * Build a stub for an "edit" update, with all the metadata but not the actual operations.
 *
 * This represents a doc being edited in a project, with enough information for sorting,
 * but avoids loading the actual operations from the zip archive until they're needed,
 * so as not to run out of memory if the project's history is large.
 *
 * @param {ManifestUpdate} update
 * @param {Entity} entity
 * @param {string} docId
 * @returns {EditDocUpdateStub}
 */
function buildEditUpdateStub(update, entity, docId) {
  return {
    stub: true,
    doc: docId,
    v: update.version,
    path: update.path,
    pathname: entity.path,
    doc_length: update.doc_length,
    meta: {
      ts: update.ts,
      origin: { kind: 'history-migration' },
    },
  }
}

/**
 * Build the sorted array of updates to be sent to project-history.
 *
 * 1. Process all the added and edited files from the track-changes archive.
 * 2. Process the other files from the project that have been added, and maybe deleted, without any edits.
 *
 * @param {string} projectId
 * @param {string} projectHistoryId
 * @param {Manifest} manifest
 * @param {Map.<string, Entity>} entities
 * @param {Map.<string, Object>} fileMap
 * @returns {Promise<Array<AnyUpdate>>}
 */
async function buildUpdates(
  projectId,
  projectHistoryId,
  manifest,
  entities,
  fileMap
) {
  /**
   * @type Array<AnyUpdate>
   */
  const updates = []

  // keep a list of doc ids which have updates in track-changes
  const updatedDocs = new Set()

  // process the existing docs with updates, from track-changes
  for (const doc of manifest.docs) {
    const entity = entities.get(doc.id)

    if (!entity) {
      throw new Error(`Entity not found for ${doc.id}`)
    }

    if (!entity.path) {
      throw new Error(`Path not found for ${doc.id}`)
    }

    // add the initial content
    const contentStart = doc.content.start

    const buffer = await fileMap.get(contentStart.path).buffer()

    /**
     * @type AddDocUpdate
     */
    const update = {
      doc: doc.id,
      pathname: entity.path,
      v: contentStart.version - 1,
      meta: {
        user_id: null, // TODO: assign this to a system user?
        ts: Number(ObjectId(doc.id).getTimestamp()),
        origin: { kind: 'history-migration' },
      },
      projectHistoryId,
      docLines: buffer.toString(),
    }

    updates.push(update)

    // push the update onto the array of updates
    for (const update of doc.updates) {
      updates.push(buildEditUpdateStub(update, entity, doc.id))
    }

    updatedDocs.add(doc.id)
  }

  // process the docs which have been added/deleted without any updates being recorded
  for (const [id, entity] of entities.entries()) {
    if (entity.deleted) {
      // deleted entity

      // add the doc/file
      if (!updatedDocs.has(id)) {
        updates.push(buildAddUpdate(entity, id, projectId, projectHistoryId))
      }

      // delete the doc/file again (there may be updates added between adding and deleting)
      updates.push(buildDeleteUpdate(entity, id, projectId, projectHistoryId))
    } else {
      if (!updatedDocs.has(id)) {
        // add "not deleted" doc that isn't in the manifest either
        updates.push(buildAddUpdate(entity, id, projectId, projectHistoryId))
      }
    }
  }

  return updates
}

/**
 * Remove the `overleaf.history` object from the project and tell project-history to delete everything for this project.
 * (note: project-history may not delete the actual history data yet, but it will at least delete the cached history id)
 *
 * @param {string} projectId
 * @returns {Promise<void>}
 */
async function deleteProjectHistory(projectId) {
  // look up the history id from the project
  const historyId = await ProjectHistoryHandler.promises.getHistoryId(projectId)
  // delete the history from project-history and history-v1
  await HistoryManager.promises.deleteProject(projectId, historyId)
  // TODO: send a message to document-updater?
  await ProjectHistoryHandler.promises.unsetHistory(projectId)
}

/**
 * Send the updates from the track changes zip file to project history
 *
 * @param {string} projectId
 * @param {string} projectHistoryId
 * @param {Array<AnyUpdate>} updates
 * @param {Map.<string, Object>} fileMap
 */
async function migrateTrackChangesUpdates(
  projectId,
  projectHistoryId,
  updates,
  fileMap
) {
  // Build a queue for each doc, sorted by version (and by timestamp within each version)
  const queues = await sortUpdatesByQueue(updates)

  const sortedUpdates = []

  let item
  do {
    // Find the earliest item from the tail of all queues
    queues.sort(earliestTimestampFirst)
    item = queues[0].pop()
    if (item) {
      sortedUpdates.push(item)
    }
  } while (item)

  // NOTE: leaving the version string code commented out, in case it ends up being needed
  // let majorVersion = 0
  // let minorVersion = 0
  for (const update of sortedUpdates) {
    // increment majorVersion if this is a file change
    if (!('op' in update)) {
      // remove v (only used for sorting)
      delete update.v

      // set version
      // majorVersion++
      // // minorVersion = 0
      // update.version = `${majorVersion}.${minorVersion}` // NOTE: not set as project-history doesn't need it and could cause problems if it gets higher than project.version
    }
    // increment minorVersion after every update
    // minorVersion++
  }

  // add each update to the Redis queue for project-history to process
  logger.debug(
    { projectId, projectHistoryId },
    'Sending updates for project to Redis'
  )

  const remainingQueueLength = await sendUpdatesToProjectHistory(
    sortedUpdates,
    projectId,
    projectHistoryId,
    fileMap
  )
  // Failure will cause queued updates to be deleted (in the catch below)

  logger.debug(
    {
      projectId,
      projectHistoryId,
      remainingQueueLength,
    },
    'Updates sent to project-history'
  )

  if (remainingQueueLength > 0) {
    throw new Error('flush to project-history did not complete')
  }

  // TODO: roll back if any of the following fail?

  // TODO: check that the Redis queue is empty?

  // Clear any old entries in the main project history queue (these will not
  // have a history id)
  await HistoryManager.promises.flushProject(projectId)
}

/**
 * Add the zip file from track changes to the project file tree.
 * We may be able to recover a failed history from the zip file in future.
 *
 * @param {string} projectId
 * @param {string} rootFolderId
 * @param {string} tempFilePath
 */

async function uploadTrackChangesArchiveToProject(
  projectId,
  rootFolderId,
  tempFilePath
) {
  const { size } = await fs.promises.stat(tempFilePath)
  if (size > settings.maxUploadSize) {
    throw new FileTooLargeError({
      message: 'track-changes archive exceeds maximum size for archiving',
      info: { size },
    })
  }
  const { fileRef } = await ProjectEntityUpdateHandler.promises.addFile(
    projectId,
    rootFolderId, // project.rootFolder[0]._id,
    `OverleafHistory-${new Date().toISOString().substring(0, 10)}.zip`,
    tempFilePath,
    null,
    null, // no owner
    null // no source
  )
  logger.debug(
    { projectId, fileRef },
    'Uploaded track-changes zip archive to project due to error in migration'
  )
}

/**
 * Check all updates for invalid characters (nonBMP or null) and substitute
 * the unicode replacement character if options.fixInvalidCharacters is true,
 * otherwise throw an exception.
 * @param {Array<AnyUpdate>} updates
 * @param {string} projectId
 * @param {Object} options
 */
function validateUpdates(updates, projectId, options) {
  const replace = options.fixInvalidCharacters
  // check for invalid characters
  function containsBadChars(str) {
    return /[\uD800-\uDBFF]/.test(str) || str.indexOf('\x00') !== -1
  }
  // Replace invalid characters so that they will be accepted by history_v1.
  function sanitise(str) {
    if (replace) {
      return str.replace(/[\uD800-\uDFFF]/g, '\uFFFD').replace('\x00', '\uFFFD')
    } else {
      throw new Error('invalid character in content')
    }
  }
  // Check size of doclines in update against max size allowed by history_v1.
  // This catches docs which are too large when created, but not when they
  // go over the limit due to edits.
  function checkSize(update) {
    if (update?.docLines?.length > settings.max_doc_length) {
      throw new FileTooLargeError({
        message: 'docLines exceeds maximum size for history',
        info: { docId: update.doc, size: update.docLines.length },
      })
    }
  }
  let latestTimestamp = 0
  // Iterate over the all the updates and their doclines or ops
  for (const update of updates) {
    checkSize(update)
    // Find the timestamp of the most recent edit (either adding a doc or editing a doc)
    // we exclude deletions as these are created in the migration and we didn't record
    // the deletion time for older files.
    const isDeleteUpdate = update.new_pathname === ''
    if (
      update.doc &&
      !isDeleteUpdate &&
      update.meta.ts &&
      update.meta.ts > latestTimestamp
    ) {
      latestTimestamp = update.meta.ts
    }
    if (update.docLines && containsBadChars(update.docLines)) {
      logger.debug({ update, replace }, 'invalid character in docLines')
      update.docLines = sanitise(update.docLines)
    }
    if (update.op) {
      for (const op of update.op) {
        if (op.i && containsBadChars(op.i)) {
          logger.debug({ update, replace }, 'invalid character in insert op')
          op.i = sanitise(op.i)
        }
        if (op.d && containsBadChars(op.d)) {
          logger.debug({ update, replace }, 'invalid character in delete op')
          op.d = sanitise(op.d)
        }
      }
    }
  }
  logger.debug(
    { projectId, latestTimestamp, date: new Date(latestTimestamp) },
    'timestamp of most recent edit'
  )
  if (options.cutoffDate && new Date(latestTimestamp) > options.cutoffDate) {
    throw new Error('project was edited after cutoff date')
  }
}

/**
 * Migrate a project's history from track-changes to project-history
 *
 * @param {string} projectId
 *
 * @returns {Promise<void>}
 */
async function migrateProjectHistory(projectId, options = {}) {
  await fse.ensureDir(settings.path.projectHistories)
  const projectHistoriesDir = await fs.promises.realpath(
    settings.path.projectHistories
  )
  const tempDir = await fs.promises.mkdtemp(projectHistoriesDir + path.sep)
  const tempFilePath = path.join(tempDir, 'project.zip')

  try {
    // fetch the zip archive of rewound content and updates from track-changes
    // store the zip archive to disk, open it and build a Map of the entries
    if (options.importZipFilePath) {
      // use an existing track-changes archive on disk
      logger.debug(
        { src: options.importZipFilePath, dst: tempFilePath },
        'importing zip file'
      )
      await fs.promises.copyFile(options.importZipFilePath, tempFilePath)
      const { size } = await fs.promises.stat(tempFilePath)
      logger.info({ projectId, size }, 'imported zip file from disk')
    } else {
      await fetchTrackChangesArchive(projectId, tempFilePath)
    }
    const fileMap = await openTrackChangesArchive(tempFilePath)

    // read the manifest from the zip archive
    const manifest = await readTrackChangesManifest(fileMap)

    // check that the project id in the manifest matches
    // to be sure we are using the correct zip file
    if (manifest.projectId !== projectId) {
      throw new Error(`Incorrect projectId: ${manifest.projectId}`)
    }

    // load the Project from MongoDB
    const project = await ProjectGetter.promises.getProject(projectId)

    // create a history id for this project
    const oldProjectHistoryId = _.get(project, 'overleaf.history.id')

    // throw an error if there is already a history associated with the project
    if (oldProjectHistoryId) {
      throw new Error(
        `Project ${projectId} already has history ${oldProjectHistoryId}`
      )
    }

    try {
      // initialize a new project history and use the history id
      // NOTE: not setting the history id on the project yet
      const projectHistoryId = await HistoryManager.promises.initializeProject(
        projectId
      )

      try {
        // build a Map of the entities (docs and fileRefs) currently in the project,
        // with _id as the key
        const entities = await processRootFolder(project)

        // find all the deleted docs for this project and add them to the entity map
        await readDeletedDocs(entities, projectId)

        // find all the deleted files for this project and add them to the entity map
        await readDeletedFiles(entities, projectId)

        // check that the paths will not be rejected
        validatePaths(entities, projectId)

        // build the array of updates that make up the new history for this project
        const updates = await buildUpdates(
          projectId,
          projectHistoryId,
          manifest,
          entities,
          fileMap
        )

        // check that the updates don't contain any characters that will be rejected by history_v1.
        validateUpdates(updates, projectId, options)

        if (updates.length) {
          await migrateTrackChangesUpdates(
            projectId,
            projectHistoryId,
            updates,
            fileMap
          )
        }
      } catch (error) {
        if (options?.archiveOnFailure) {
          // on error, optionally store the zip file in the project for future reference
          logger.debug(
            { projectId, error },
            'Error sending track-changes updates to project history, attempting to archive zip file in project'
          )
          try {
            await uploadTrackChangesArchiveToProject(
              projectId,
              project.rootFolder[0]._id,
              tempFilePath
            )
          } catch (error) {
            if (error instanceof InvalidNameError) {
              logger.info({ projectId }, 'zip file already archived in project')
            } else {
              throw error
            }
          } finally {
            // roll back the last updated timestamp and user
            logger.debug(
              { projectId },
              'rolling back last updated time after uploading zip file'
            )
            await ProjectUpdateHandler.promises.resetUpdated(
              projectId,
              project.lastUpdated,
              project.lastUpdatedBy
            )
          }
          // set the overleaf.history.zipFileArchivedInProject flag for future reference
          await ProjectHistoryHandler.promises.setMigrationArchiveFlag(
            projectId
          )
          // we consider archiving the zip file as "success" (at least we've given up on attempting
          // to migrate the history) so we don't rethrow the error and continue to initialise the new
          // empty history below.
        } else {
          // if we're not archiving the zip file then we rethrown the error to fail the migration
          throw error
        }
      }

      // set the project's history id once the updates have been successfully processed
      // (or we have given up and archived the zip file in the project).
      logger.debug(
        { projectId, projectHistoryId },
        'Setting history id on project'
      )
      await ProjectHistoryHandler.promises.setHistoryId(
        projectId,
        projectHistoryId
      )

      try {
        // tell document updater to reload docs with the new history id
        logger.debug({ projectId }, 'Asking document-updater to clear project')
        await DocumentUpdaterHandler.promises.flushProjectToMongoAndDelete(
          projectId
        )

        // run a project history resync in case any changes have arrived since the migration
        logger.debug(
          { projectId },
          'Asking project-history to force resync project'
        )

        await HistoryManager.promises.resyncProject(projectId, {
          force: true,
          origin: { kind: 'history-migration' },
        })
      } catch (error) {
        if (options.forceNewHistoryOnFailure) {
          logger.warn(
            { projectId },
            'failed to resync project, forcing new history'
          )
        } else {
          throw error
        }
      }
      logger.debug(
        { projectId },
        'Switching on full project history display for project'
      )
      // Set the display to v2 history but allow downgrading (second argument allowDowngrade = true)
      await ProjectHistoryHandler.promises.upgradeHistory(projectId, true)
    } catch (error) {
      // delete the history id again if something failed?
      logger.warn(
        OError.tag(
          error,
          'Something went wrong flushing and resyncing project; clearing full project history for project',
          { projectId }
        )
      )
      await deleteProjectHistory(projectId)

      throw error
    }
  } finally {
    // clean up the temporary directory
    await fse.remove(tempDir)
  }
}

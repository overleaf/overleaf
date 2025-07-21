// @ts-check
import Events from 'node:events'
import fs from 'node:fs'
import Stream from 'node:stream'
import { ObjectId } from 'mongodb'
import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'
import { Blob } from 'overleaf-editor-core'
import {
  BlobStore,
  getStringLengthOfFile,
  makeBlobForFile,
} from '../lib/blob_store/index.js'
import { db } from '../lib/mongodb.js'
import commandLineArgs from 'command-line-args'
import readline from 'node:readline'
import { NotFoundError } from '@overleaf/object-persistor/src/Errors.js'
import { setTimeout } from 'node:timers/promises'

// Silence warning.
Events.setMaxListeners(20)

// Enable caching for ObjectId.toString()
ObjectId.cacheHexString = true

/**
 * @typedef {import("mongodb").Collection} Collection
 * @typedef {import("mongodb").Collection<Project>} ProjectsCollection
 * @typedef {import("mongodb").Collection<{project: Project}>} DeletedProjectsCollection
 */

/**
 * @typedef {Object} FileRef
 * @property {ObjectId} _id
 * @property {string} hash
 */

/**
 * @typedef {Object} Folder
 * @property {Array<Folder>} folders
 * @property {Array<FileRef>} fileRefs
 */

/**
 * @typedef {Object} Project
 * @property {ObjectId} _id
 * @property {Array<Folder>} rootFolder
 * @property {{history: {id: (number|string)}}} overleaf
 */

/**
 * @return {{FIX_NOT_FOUND: boolean, FIX_HASH_MISMATCH: boolean, FIX_MISSING_HASH: boolean, LOGS: string}}
 */
function parseArgs() {
  const args = commandLineArgs([
    { name: 'fixNotFound', type: String, defaultValue: 'true' },
    { name: 'fixHashMismatch', type: String, defaultValue: 'true' },
    { name: 'fixMissingHash', type: String, defaultValue: 'true' },
    { name: 'logs', type: String, defaultValue: '' },
  ])
  /**
   * commandLineArgs cannot handle --foo=false, so go the long way
   * @param {string} name
   * @return {boolean}
   */
  function boolVal(name) {
    const v = args[name]
    if (['true', 'false'].includes(v)) return v === 'true'
    throw new Error(`expected "true" or "false" for boolean option ${name}`)
  }
  return {
    FIX_HASH_MISMATCH: boolVal('fixNotFound'),
    FIX_NOT_FOUND: boolVal('fixHashMismatch'),
    FIX_MISSING_HASH: boolVal('fixMissingHash'),
    LOGS: args.logs,
  }
}

const { FIX_HASH_MISMATCH, FIX_NOT_FOUND, FIX_MISSING_HASH, LOGS } = parseArgs()
if (!LOGS) {
  throw new Error('--logs parameter missing')
}
const BUFFER_DIR = fs.mkdtempSync(
  process.env.BUFFER_DIR_PREFIX || '/tmp/back_fill_file_hash-'
)
const USER_FILES_BUCKET_NAME = process.env.USER_FILES_BUCKET_NAME || ''
if (!USER_FILES_BUCKET_NAME) {
  throw new Error('env var USER_FILES_BUCKET_NAME is missing')
}
// https://nodejs.org/api/stream.html#streamgetdefaulthighwatermarkobjectmode
const STREAM_HIGH_WATER_MARK = parseInt(
  process.env.STREAM_HIGH_WATER_MARK || (64 * 1024).toString(),
  10
)
const SLEEP_BEFORE_EXIT = parseInt(process.env.SLEEP_BEFORE_EXIT || '1000', 10)

// Filestore endpoint location
const FILESTORE_HOST = process.env.FILESTORE_HOST || '127.0.0.1'
const FILESTORE_PORT = process.env.FILESTORE_PORT || '3009'

async function fetchFromFilestore(projectId, fileId) {
  const url = `http://${FILESTORE_HOST}:${FILESTORE_PORT}/project/${projectId}/file/${fileId}`
  const response = await fetch(url)
  if (!response.ok) {
    if (response.status === 404) {
      throw new NotFoundError('file not found in filestore', {
        status: response.status,
      })
    }
    const body = await response.text()
    throw new OError('fetchFromFilestore failed', {
      projectId,
      fileId,
      status: response.status,
      body,
    })
  }
  if (!response.body) {
    throw new OError('fetchFromFilestore response has no body', {
      projectId,
      fileId,
      status: response.status,
    })
  }
  return response.body
}

/** @type {ProjectsCollection} */
const projectsCollection = db.collection('projects')
/** @type {DeletedProjectsCollection} */
const deletedProjectsCollection = db.collection('deletedProjects')

let gracefulShutdownInitiated = false

process.on('SIGINT', handleSignal)
process.on('SIGTERM', handleSignal)

function handleSignal() {
  gracefulShutdownInitiated = true
  console.warn('graceful shutdown initiated, draining queue')
}

class FileDeletedError extends OError {}

/** @type {Map<string,{project: Project, projectSoftDeleted: boolean}>} */
const PROJECT_CACHE = new Map()

/**
 * @param {string} projectId
 * @return {Promise<{project: Project, projectSoftDeleted: boolean}>}
 */
async function getProject(projectId) {
  const cached = PROJECT_CACHE.get(projectId)
  if (cached) return cached

  let projectSoftDeleted
  let project = await projectsCollection.findOne({
    _id: new ObjectId(projectId),
  })
  if (project) {
    projectSoftDeleted = false
  } else {
    const softDeleted = await deletedProjectsCollection.findOne({
      'deleterData.deletedProjectId': new ObjectId(projectId),
      project: { $exists: true },
    })
    if (!softDeleted) {
      throw new OError('project hard-deleted')
    }
    project = softDeleted.project
    projectSoftDeleted = true
  }
  PROJECT_CACHE.set(projectId, { projectSoftDeleted, project })
  return { projectSoftDeleted, project }
}

/**
 * @param {Folder} folder
 * @param {string} fileId
 * @return {{path: string, fileRef: FileRef, folder: Folder}|null}
 */
function getFileTreePath(folder, fileId) {
  if (!folder) return null
  let idx = 0
  if (Array.isArray(folder.fileRefs)) {
    for (const fileRef of folder.fileRefs) {
      if (fileRef?._id.toString() === fileId) {
        return {
          fileRef,
          path: `.fileRefs.${idx}`,
          folder,
        }
      }
      idx++
    }
  }
  idx = 0
  if (Array.isArray(folder.folders)) {
    for (const child of folder.folders) {
      const match = getFileTreePath(child, fileId)
      if (match) {
        return {
          fileRef: match.fileRef,
          folder: match.folder,
          path: `.folders.${idx}${match.path}`,
        }
      }
      idx++
    }
  }
  return null
}

/**
 * @param {string} projectId
 * @param {string} fileId
 * @return {Promise<{fileRef: FileRef, folder: Folder, fullPath: string, query: Object, projectSoftDeleted: boolean}>}
 */
async function findFile(projectId, fileId) {
  const { projectSoftDeleted, project } = await getProject(projectId)
  const match = getFileTreePath(project.rootFolder[0], fileId)
  if (!match) {
    throw new FileDeletedError('file not found in file-tree', {
      projectSoftDeleted,
    })
  }
  const { path, fileRef, folder } = match
  let fullPath
  let query
  if (projectSoftDeleted) {
    fullPath = `project.rootFolder.0${path}`
    query = {
      'deleterData.deletedProjectId': new ObjectId(projectId),
      [`${fullPath}._id`]: new ObjectId(fileId),
    }
  } else {
    fullPath = `rootFolder.0${path}`
    query = {
      _id: new ObjectId(projectId),
      [`${fullPath}._id`]: new ObjectId(fileId),
    }
  }
  return {
    projectSoftDeleted,
    query,
    fullPath,
    fileRef,
    folder,
  }
}

/**
 * @param {string} line
 * @return {Promise<boolean>}
 */
async function fixNotFound(line) {
  const { projectId, fileId, bucketName } = JSON.parse(line)
  if (bucketName !== USER_FILES_BUCKET_NAME) {
    throw new OError('not found case for another bucket')
  }

  const { projectSoftDeleted, query, fullPath, fileRef, folder } =
    await findFile(projectId, fileId)
  logger.info({ projectId, fileId, fileRef }, 'removing fileRef')
  // Copied from _removeElementFromMongoArray (https://github.com/overleaf/internal/blob/11e09528c153de6b7766d18c3c90d94962190371/services/web/app/src/Features/Project/ProjectEntityMongoUpdateHandler.js)
  const nonArrayPath = fullPath.slice(0, fullPath.lastIndexOf('.'))
  let result
  if (projectSoftDeleted) {
    result = await deletedProjectsCollection.updateOne(query, {
      $pull: { [nonArrayPath]: { _id: new ObjectId(fileId) } },
      $inc: { 'project.version': 1 },
    })
  } else {
    result = await projectsCollection.updateOne(query, {
      $pull: { [nonArrayPath]: { _id: new ObjectId(fileId) } },
      $inc: { version: 1 },
    })
  }
  if (result.matchedCount !== 1) {
    throw new OError('file-tree write did not match', { result })
  }
  // Update the cache. The mongo-path of the next file will be off otherwise.
  folder.fileRefs = folder.fileRefs.filter(f => !f._id.equals(fileId))
  return true
}

/**
 * @param {string} projectId
 * @param {string} fileId
 * @param {string} hash
 * @return {Promise<void>}
 */
async function setHashInMongo(projectId, fileId, hash) {
  const { projectSoftDeleted, query, fullPath, fileRef } = await findFile(
    projectId,
    fileId
  )
  if (fileRef.hash === hash) return
  logger.info({ projectId, fileId, fileRef, hash }, 'setting fileRef hash')
  let result
  if (projectSoftDeleted) {
    result = await deletedProjectsCollection.updateOne(query, {
      $set: { [`${fullPath}.hash`]: hash },
      $inc: { 'project.version': 1 },
    })
  } else {
    result = await projectsCollection.updateOne(query, {
      $set: { [`${fullPath}.hash`]: hash },
      $inc: { version: 1 },
    })
  }
  if (result.matchedCount !== 1) {
    throw new OError('file-tree write did not match', { result })
  }
  fileRef.hash = hash // Update cache for completeness.
}

/**
 * @param {string} projectId
 * @param {string} fileId
 * @param {string} historyId
 * @return {Promise<void>}
 */
async function importRestoredFilestoreFile(projectId, fileId, historyId) {
  const path = `${BUFFER_DIR}/${projectId}_${fileId}`
  try {
    let s
    try {
      s = await fetchFromFilestore(projectId, fileId)
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw new OError('missing blob, need to restore filestore file', {
          projectId,
          fileId,
        })
      }
      throw err
    }
    await Stream.promises.pipeline(
      s,
      fs.createWriteStream(path, { highWaterMark: STREAM_HIGH_WATER_MARK })
    )
    const blobStore = new BlobStore(historyId)
    const blob = await blobStore.putFile(path)
    await setHashInMongo(projectId, fileId, blob.getHash())
  } finally {
    await fs.promises.rm(path, { force: true })
  }
}

/**
 * @param {string} projectId
 * @param {string} fileId
 * @param {string} path
 * @return {Promise<Blob>}
 */
async function bufferFilestoreFileToDisk(projectId, fileId, path) {
  try {
    await Stream.promises.pipeline(
      await fetchFromFilestore(projectId, fileId),
      fs.createWriteStream(path, { highWaterMark: STREAM_HIGH_WATER_MARK })
    )
    const blob = await makeBlobForFile(path)
    blob.setStringLength(
      await getStringLengthOfFile(blob.getByteLength(), path)
    )
    return blob
  } catch (err) {
    if (err instanceof NotFoundError) {
      throw new OError('missing blob, need to restore filestore file', {
        projectId,
        fileId,
      })
    }
    throw err
  }
}

/**
 * @param {string} projectId
 * @param {string} fileId
 * @return {Promise<string>}
 */
async function computeFilestoreFileHash(projectId, fileId) {
  const path = `${BUFFER_DIR}/${projectId}_${fileId}`
  try {
    const blob = await bufferFilestoreFileToDisk(projectId, fileId, path)
    return blob.getHash()
  } finally {
    await fs.promises.rm(path, { force: true })
  }
}

/**
 * @param {string} projectId
 * @param {string} fileId
 * @return {Promise<void>}
 */
async function uploadFilestoreFile(projectId, fileId) {
  const path = `${BUFFER_DIR}/${projectId}_${fileId}`
  try {
    const blob = await bufferFilestoreFileToDisk(projectId, fileId, path)
    const hash = blob.getHash()
    try {
      await ensureBlobExistsForFile(projectId, fileId, hash)
    } catch (err) {
      if (!(err instanceof Blob.NotFoundError)) throw err

      const { project } = await getProject(projectId)
      const historyId = project.overleaf.history.id.toString()
      const blobStore = new BlobStore(historyId)
      await blobStore.putBlob(path, blob)
      await ensureBlobExistsForFile(projectId, fileId, hash)
    }
  } finally {
    await fs.promises.rm(path, { force: true })
  }
}

/**
 * @param {string} line
 * @return {Promise<boolean>}
 */
async function fixHashMismatch(line) {
  const {
    projectId,
    fileId,
    hash: computedHash,
    entry: {
      hash: fileTreeHash,
      ctx: { historyId },
    },
  } = JSON.parse(line)
  const blobStore = new BlobStore(historyId)
  if (await blobStore.getBlob(fileTreeHash)) {
    throw new OError('found blob with computed filestore object hash')
  }
  if (!(await blobStore.getBlob(computedHash))) {
    await importRestoredFilestoreFile(projectId, fileId, historyId)
    return true
  }
  return await ensureBlobExistsForFile(projectId, fileId, computedHash)
}

/**
 * @param {string} projectId
 * @param {string} fileId
 * @param {string} hash
 * @return {Promise<boolean>}
 */
async function hashAlreadyUpdatedInFileTree(projectId, fileId, hash) {
  const { fileRef } = await findFile(projectId, fileId)
  return fileRef.hash === hash
}

/**
 * @param {string} projectId
 * @param {string} fileId
 * @param {string} hash
 * @return {Promise<boolean>}
 */
async function ensureBlobExistsForFile(projectId, fileId, hash) {
  const { project } = await getProject(projectId)
  const historyId = project.overleaf.history.id.toString()
  const blobStore = new BlobStore(historyId)
  if (
    (await hashAlreadyUpdatedInFileTree(projectId, fileId, hash)) &&
    (await blobStore.getBlob(hash))
  ) {
    return false // already processed
  }

  const stream = await blobStore.getStream(hash)
  const path = `${BUFFER_DIR}/${historyId}_${hash}`
  try {
    await Stream.promises.pipeline(
      stream,
      fs.createWriteStream(path, {
        highWaterMark: STREAM_HIGH_WATER_MARK,
      })
    )

    const writtenBlob = await makeBlobForFile(path)
    writtenBlob.setStringLength(
      await getStringLengthOfFile(writtenBlob.getByteLength(), path)
    )
    if (writtenBlob.getHash() !== hash) {
      // Double check download, better safe than sorry.
      throw new OError('blob corrupted', { writtenBlob, hash })
    }

    let blob = await blobStore.getBlob(hash)
    if (!blob) {
      // Calling blobStore.putBlob would result in the same error again.
      // HACK: Skip upload to GCS and finalize putBlob operation directly.
      await blobStore.backend.insertBlob(historyId, writtenBlob)
    }
  } finally {
    await fs.promises.rm(path, { force: true })
  }
  await setHashInMongo(projectId, fileId, hash)
  return true
}

/**
 * @param {string} line
 * @return {Promise<boolean>}
 */
async function fixMissingHash(line) {
  let { projectId, _id: fileId } = JSON.parse(line)
  const {
    fileRef: { hash },
  } = await findFile(projectId, fileId)
  if (hash) {
    // processed, double check
    return await ensureBlobExistsForFile(projectId, fileId, hash)
  }
  await uploadFilestoreFile(projectId, fileId)
  return true
}

const CASES = {
  'not found': {
    match: 'NotFoundError',
    flag: FIX_NOT_FOUND,
    action: fixNotFound,
  },
  'hash mismatch': {
    match: 'OError: hash mismatch',
    flag: FIX_HASH_MISMATCH,
    action: fixHashMismatch,
  },
  'missing file hash': {
    match: '"bad file hash"',
    flag: FIX_MISSING_HASH,
    action: fixMissingHash,
  },
}

const STATS = {
  processedLines: 0,
  success: 0,
  alreadyProcessed: 0,
  fileDeleted: 0,
  skipped: 0,
  failed: 0,
  unmatched: 0,
}
function logStats() {
  console.log(
    JSON.stringify({
      time: new Date(),
      gracefulShutdownInitiated,
      ...STATS,
    })
  )
}
setInterval(logStats, 10_000)

async function processLog() {
  const rl = readline.createInterface({
    input: fs.createReadStream(LOGS),
  })
  nextLine: for await (const line of rl) {
    if (gracefulShutdownInitiated) break
    STATS.processedLines++
    if (
      !(
        line.includes('"failed to process file"') ||
        // Process missing hashes as flagged by find_malformed_filetrees.mjs
        line.includes('"bad file-tree path"')
      )
    ) {
      continue
    }

    for (const [name, { match, flag, action }] of Object.entries(CASES)) {
      if (!line.includes(match)) continue
      if (flag) {
        try {
          if (await action(line)) {
            STATS.success++
          } else {
            STATS.alreadyProcessed++
          }
        } catch (err) {
          if (err instanceof FileDeletedError) {
            STATS.fileDeleted++
            logger.info({ err, line }, 'file deleted, skipping')
          } else {
            STATS.failed++
            logger.error({ err, line }, `failed to fix ${name}`)
          }
        }
      } else {
        STATS.skipped++
      }
      continue nextLine
    }
    STATS.unmatched++
    logger.warn({ line }, 'unknown fatal error')
  }
}

async function main() {
  try {
    await processLog()
  } finally {
    logStats()
    try {
      await fs.promises.rm(BUFFER_DIR, { recursive: true, force: true })
    } catch (err) {
      console.error(`Cleanup of BUFFER_DIR=${BUFFER_DIR} failed`, err)
    }
  }
  const { skipped, failed, unmatched } = STATS
  await setTimeout(SLEEP_BEFORE_EXIT)
  if (failed > 0) {
    process.exit(Math.min(failed, 99))
  } else if (unmatched > 0) {
    process.exit(100)
  } else if (skipped > 0) {
    process.exit(101)
  } else {
    process.exit(0)
  }
}

await main()

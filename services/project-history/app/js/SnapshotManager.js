// @ts-check

import { callbackify } from 'node:util'
import Core from 'overleaf-editor-core'
import { Readable as StringStream } from 'node:stream'
import OError from '@overleaf/o-error'
import * as HistoryStoreManager from './HistoryStoreManager.js'
import * as WebApiManager from './WebApiManager.js'
import * as Errors from './Errors.js'
import _ from 'lodash'

/**
 * @import { Snapshot } from 'overleaf-editor-core'
 * @import { RangesSnapshot } from './types'
 */

StringStream.prototype._read = function () {}

const MAX_REQUESTS = 4 // maximum number of parallel requests to v1 history service

/**
 *
 * @param {string} projectId
 * @param {number} version
 * @param {string} pathname
 */
async function getFileSnapshotStream(projectId, version, pathname) {
  const snapshot = await _getSnapshotAtVersion(projectId, version)

  const file = snapshot.getFile(pathname)
  if (file == null) {
    throw new Errors.NotFoundError(`${pathname} not found`, {
      projectId,
      version,
      pathname,
    })
  }

  const historyId = await WebApiManager.promises.getHistoryId(projectId)
  if (file.isEditable()) {
    await file.load('eager', HistoryStoreManager.getBlobStore(historyId))
    const stream = new StringStream()
    stream.push(file.getContent({ filterTrackedDeletes: true }))
    stream.push(null)
    return stream
  } else {
    return await HistoryStoreManager.promises.getProjectBlobStream(
      historyId,
      file.getHash()
    )
  }
}

/**
 * Constructs a snapshot of the ranges in a document-updater compatible format.
 * Positions will be relative to a document where tracked deletes have been
 * removed from the string. This also means that if a tracked delete overlaps
 * a comment range, the comment range will be truncated.
 *
 * @param {string} projectId
 * @param {number} version
 * @param {string} pathname
 * @returns {Promise<RangesSnapshot>}
 */
async function getRangesSnapshot(projectId, version, pathname) {
  const snapshot = await _getSnapshotAtVersion(projectId, version)
  const file = snapshot.getFile(pathname)
  if (!file) {
    throw new Errors.NotFoundError(`${pathname} not found`, {
      projectId,
      version,
      pathname,
    })
  }
  if (!file.isEditable()) {
    // A binary file has no tracked changes or comments
    return {
      changes: [],
      comments: [],
    }
  }
  const historyId = await WebApiManager.promises.getHistoryId(projectId)
  await file.load('eager', HistoryStoreManager.getBlobStore(historyId))

  // Use the utility function from overleaf-editor-core
  const { changes, comments } = Core.getDocUpdaterCompatibleRanges(file)
  return { changes, comments }
}

/**
 * Gets the file metadata at a specific version.
 *
 * @param {string} projectId
 * @param {number} version
 * @param {string} pathname
 * @returns {Promise<{metadata: any}>}
 */
async function getFileMetadataSnapshot(projectId, version, pathname) {
  const snapshot = await _getSnapshotAtVersion(projectId, version)
  const file = snapshot.getFile(pathname)
  if (!file) {
    throw new Errors.NotFoundError(`${pathname} not found`, {
      projectId,
      version,
      pathname,
    })
  }
  const rawMetadata = file.getMetadata()
  const metadata = _.isEmpty(rawMetadata) ? undefined : rawMetadata

  return { metadata }
}

// Returns project snapshot containing the document content for files with
// text operations in the relevant chunk, and hashes for unmodified/binary
// files. Used by git bridge to get the state of the project.
async function getProjectSnapshot(projectId, version) {
  const snapshot = await _getSnapshotAtVersion(projectId, version)
  const historyId = await WebApiManager.promises.getHistoryId(projectId)
  await _loadFilesLimit(
    snapshot,
    'eager',
    HistoryStoreManager.getBlobStore(historyId)
  )
  return {
    projectId,
    files: snapshot.getFileMap().map(file => {
      if (!file) {
        return null
      }
      const content = file.getContent({
        filterTrackedDeletes: true,
      })
      if (content === null) {
        return { data: { hash: file.getHash() } }
      }
      return { data: { content } }
    }),
  }
}

async function getPathsAtVersion(projectId, version) {
  const snapshot = await _getSnapshotAtVersion(projectId, version)
  return {
    paths: snapshot.getFilePathnames(),
  }
}

/**
 *
 * @param {string} projectId
 * @param {number} version
 */
async function _getSnapshotAtVersion(projectId, version) {
  const historyId = await WebApiManager.promises.getHistoryId(projectId)
  const data = await HistoryStoreManager.promises.getChunkAtVersion(
    projectId,
    historyId,
    version
  )
  const chunk = Core.Chunk.fromRaw(data.chunk)
  const snapshot = chunk.getSnapshot()
  const changes = chunk.getChanges().slice(0, version - chunk.getStartVersion())
  snapshot.applyAll(changes)
  return snapshot
}

/**
 * @param {string} projectId
 * @param {string} historyId
 * @return {Promise<Record<string, import('overleaf-editor-core').File>>}
 */
async function getLatestSnapshotFiles(projectId, historyId) {
  const data = await HistoryStoreManager.promises.getMostRecentChunk(
    projectId,
    historyId
  )
  return await getLatestSnapshotFilesForChunk(historyId, data)
}

/**
 * @param {string} historyId
 * @param {{chunk: import('overleaf-editor-core/lib/types.js').RawChunk}} chunk
 * @return {Promise<Record<string, import('overleaf-editor-core').File>>}
 */
async function getLatestSnapshotFilesForChunk(historyId, chunk) {
  const { snapshot } = getLatestSnapshotFromChunk(chunk)
  const snapshotFiles = await snapshot.loadFiles(
    'lazy',
    HistoryStoreManager.getBlobStore(historyId)
  )
  return snapshotFiles
}

/**
 * @param {string} projectId
 * @param {string} historyId
 * @return {Promise<{version: number, snapshot: import('overleaf-editor-core').Snapshot}>}
 */
async function getLatestSnapshot(projectId, historyId) {
  const data = await HistoryStoreManager.promises.getMostRecentChunk(
    projectId,
    historyId
  )
  return getLatestSnapshotFromChunk(data)
}

/**
 * @param {{chunk: import('overleaf-editor-core/lib/types.js').RawChunk}} data
 * @return {{version: number, snapshot: import('overleaf-editor-core').Snapshot}}
 */
function getLatestSnapshotFromChunk(data) {
  if (data == null || data.chunk == null) {
    throw new OError('undefined chunk')
  }

  // apply all the changes in the chunk to get the current snapshot
  const chunk = Core.Chunk.fromRaw(data.chunk)
  const snapshot = chunk.getSnapshot()
  const changes = chunk.getChanges()
  snapshot.applyAll(changes)
  return {
    snapshot,
    version: chunk.getEndVersion(),
  }
}

async function getChangesInChunkSince(projectId, historyId, sinceVersion) {
  const latestChunk = Core.Chunk.fromRaw(
    (
      await HistoryStoreManager.promises.getMostRecentChunk(
        projectId,
        historyId
      )
    ).chunk
  )
  if (sinceVersion > latestChunk.getEndVersion()) {
    throw new Errors.BadRequestError(
      'requested version past the end of the history'
    )
  }
  const latestStartVersion = latestChunk.getStartVersion()
  let chunk = latestChunk
  if (sinceVersion < latestStartVersion) {
    chunk = Core.Chunk.fromRaw(
      (
        await HistoryStoreManager.promises.getChunkAtVersion(
          projectId,
          historyId,
          sinceVersion
        )
      ).chunk
    )
  }
  const changes = chunk
    .getChanges()
    .slice(sinceVersion - chunk.getStartVersion())
  return { latestStartVersion, changes }
}

async function _loadFilesLimit(snapshot, kind, blobStore) {
  await snapshot.fileMap.mapAsync(async file => {
    // only load changed files or files with tracked changes, others can be
    // dereferenced from their blobs (this method is only used by the git
    // bridge which understands how to load blobs).
    if (!file.isEditable() || (file.getHash() && !file.getRangesHash())) {
      return
    }
    await file.load(kind, blobStore)
  }, MAX_REQUESTS)
}

// EXPORTS

const getChangesInChunkSinceCb = callbackify(getChangesInChunkSince)
const getFileSnapshotStreamCb = callbackify(getFileSnapshotStream)
const getProjectSnapshotCb = callbackify(getProjectSnapshot)
const getLatestSnapshotCb = callbackify(getLatestSnapshot)
const getLatestSnapshotFilesCb = callbackify(getLatestSnapshotFiles)
const getLatestSnapshotFilesForChunkCb = callbackify(
  getLatestSnapshotFilesForChunk
)
const getRangesSnapshotCb = callbackify(getRangesSnapshot)
const getFileMetadataSnapshotCb = callbackify(getFileMetadataSnapshot)
const getPathsAtVersionCb = callbackify(getPathsAtVersion)

export {
  getLatestSnapshotFromChunk,
  getChangesInChunkSinceCb as getChangesInChunkSince,
  getFileSnapshotStreamCb as getFileSnapshotStream,
  getProjectSnapshotCb as getProjectSnapshot,
  getFileMetadataSnapshotCb as getFileMetadataSnapshot,
  getLatestSnapshotCb as getLatestSnapshot,
  getLatestSnapshotFilesCb as getLatestSnapshotFiles,
  getLatestSnapshotFilesForChunkCb as getLatestSnapshotFilesForChunk,
  getRangesSnapshotCb as getRangesSnapshot,
  getPathsAtVersionCb as getPathsAtVersion,
}

export const promises = {
  getChangesInChunkSince,
  getFileSnapshotStream,
  getProjectSnapshot,
  getLatestSnapshot,
  getLatestSnapshotFiles,
  getLatestSnapshotFilesForChunk,
  getRangesSnapshot,
  getPathsAtVersion,
  getFileMetadataSnapshot,
}

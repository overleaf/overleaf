// @ts-check

import { callbackify } from 'util'
import Core from 'overleaf-editor-core'
import { Readable as StringStream } from 'stream'
import OError from '@overleaf/o-error'
import * as HistoryStoreManager from './HistoryStoreManager.js'
import * as WebApiManager from './WebApiManager.js'
import * as Errors from './Errors.js'

/**
 * @typedef {import('stream').Readable} ReadableStream
 * @typedef {import('overleaf-editor-core').Snapshot} Snapshot
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

async function getLatestSnapshot(projectId, historyId) {
  const data = await HistoryStoreManager.promises.getMostRecentChunk(
    projectId,
    historyId
  )
  if (data == null || data.chunk == null) {
    throw new OError('undefined chunk')
  }

  // apply all the changes in the chunk to get the current snapshot
  const chunk = Core.Chunk.fromRaw(data.chunk)
  const snapshot = chunk.getSnapshot()
  const changes = chunk.getChanges()
  snapshot.applyAll(changes)
  const snapshotFiles = await snapshot.loadFiles(
    'lazy',
    HistoryStoreManager.getBlobStore(historyId)
  )
  return snapshotFiles
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

const getFileSnapshotStreamCb = callbackify(getFileSnapshotStream)
const getProjectSnapshotCb = callbackify(getProjectSnapshot)
const getLatestSnapshotCb = callbackify(getLatestSnapshot)

export {
  getFileSnapshotStreamCb as getFileSnapshotStream,
  getProjectSnapshotCb as getProjectSnapshot,
  getLatestSnapshotCb as getLatestSnapshot,
}

export const promises = {
  getFileSnapshotStream,
  getProjectSnapshot,
  getLatestSnapshot,
}

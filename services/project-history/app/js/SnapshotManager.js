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
 * @typedef {import('./types').RangesSnapshot} RangesSnapshot
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
    throw new Error('File is not editable')
  }
  const historyId = await WebApiManager.promises.getHistoryId(projectId)
  await file.load('eager', HistoryStoreManager.getBlobStore(historyId))
  const content = file.getContent()
  if (content == null) {
    throw new Error('Unable to read file contents')
  }
  const trackedChanges = file.getTrackedChanges().asSorted()
  const comments = file.getComments().toArray()
  const docUpdaterCompatibleTrackedChanges = []

  let trackedDeletionOffset = 0
  for (const trackedChange of trackedChanges) {
    const isTrackedDeletion = trackedChange.tracking.type === 'delete'
    const trackedChangeContent = content.slice(
      trackedChange.range.start,
      trackedChange.range.end
    )
    const tcContent = isTrackedDeletion
      ? { d: trackedChangeContent }
      : { i: trackedChangeContent }
    docUpdaterCompatibleTrackedChanges.push({
      op: {
        p: trackedChange.range.start - trackedDeletionOffset,
        ...tcContent,
      },
      metadata: {
        ts: trackedChange.tracking.ts.toISOString(),
        user_id: trackedChange.tracking.userId,
      },
    })
    if (isTrackedDeletion) {
      trackedDeletionOffset += trackedChange.range.length
    }
  }

  //  Comments are shifted left by the length of any previous tracked deletions.
  //  If they  overlap with a tracked deletion, they are truncated.
  //
  // Example:
  //   { } comment
  //   [ ] tracked deletion
  //   the quic[k {b]rown [fox] jum[ps} ove]r the lazy dog
  //   => rown  jum
  //      starting at position 8
  const trackedDeletions = trackedChanges.filter(
    tc => tc.tracking.type === 'delete'
  )
  const docUpdaterCompatibleComments = []
  for (const comment of comments) {
    trackedDeletionOffset = 0
    let trackedDeletionIndex = 0
    if (comment.ranges.length === 0) {
      // Translate detached comments into zero length comments at position 0
      docUpdaterCompatibleComments.push({
        op: {
          p: 0,
          c: '',
          t: comment.id,
          resolved: comment.resolved,
        },
      })
      continue
    }
    for (const commentRange of comment.ranges) {
      let commentRangeContent = ''
      let offsetFromOverlappingRangeAtStart = 0
      while (
        trackedDeletionIndex < trackedDeletions.length &&
        trackedDeletions[trackedDeletionIndex].range.start <
          commentRange.start &&
        trackedDeletions[trackedDeletionIndex].range.end <= commentRange.start
      ) {
        // Skip over tracked deletions that are before the current comment range
        trackedDeletionOffset +=
          trackedDeletions[trackedDeletionIndex].range.length
        trackedDeletionIndex++
      }

      if (
        trackedDeletions[trackedDeletionIndex]?.range.start < commentRange.start
      ) {
        // There's overlap with a tracked deletion, move the position left and
        // truncate the overlap
        offsetFromOverlappingRangeAtStart =
          commentRange.start -
          trackedDeletions[trackedDeletionIndex].range.start
      }

      // The position of the comment in the document after tracked deletions
      const position =
        commentRange.start -
        trackedDeletionOffset -
        offsetFromOverlappingRangeAtStart

      let cursor = commentRange.start
      while (cursor < commentRange.end) {
        const trackedDeletion = trackedDeletions[trackedDeletionIndex]
        if (
          !trackedDeletion ||
          trackedDeletion.range.start >= commentRange.end
        ) {
          // We've run out of relevant tracked changes
          commentRangeContent += content.slice(cursor, commentRange.end)
          break
        }
        if (trackedDeletion.range.start > cursor) {
          // There's a gap between the current cursor and the tracked deletion
          commentRangeContent += content.slice(
            cursor,
            trackedDeletion.range.start
          )
        }
        // Skip to the end of the tracked delete
        cursor = trackedDeletion.range.end
        trackedDeletionIndex++
        trackedDeletionOffset += trackedDeletion.range.length
      }
      docUpdaterCompatibleComments.push({
        op: {
          p: position,
          c: commentRangeContent,
          t: comment.id,
          resolved: comment.resolved,
        },
      })
    }
  }

  return {
    changes: docUpdaterCompatibleTrackedChanges,
    comments: docUpdaterCompatibleComments,
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
const getRangesSnapshotCb = callbackify(getRangesSnapshot)

export {
  getFileSnapshotStreamCb as getFileSnapshotStream,
  getProjectSnapshotCb as getProjectSnapshot,
  getLatestSnapshotCb as getLatestSnapshot,
  getRangesSnapshotCb as getRangesSnapshot,
}

export const promises = {
  getFileSnapshotStream,
  getProjectSnapshot,
  getLatestSnapshot,
  getRangesSnapshot,
}

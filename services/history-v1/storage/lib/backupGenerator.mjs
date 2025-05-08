/**
 * Provides a generator function to back up project chunks and blobs.
 */

import chunkStore from './chunk_store/index.js'

import {
  GLOBAL_BLOBS, // NOTE:  must call loadGlobalBlobs() before using this
  BlobStore,
} from './blob_store/index.js'

import assert from './assert.js'

async function lookBehindForSeenBlobs(
  projectId,
  chunk,
  lastBackedUpVersion,
  seenBlobs
) {
  if (chunk.startVersion === 0) {
    return // this is the first chunk, no need to check for blobs in the previous chunk
  }
  if (chunk.startVersion > 0 && lastBackedUpVersion > chunk.startVersion) {
    return // the snapshot in this chunk has already been backed up
  }
  if (
    chunk.startVersion > 0 &&
    lastBackedUpVersion === chunk.startVersion // same as previousChunk.endVersion
  ) {
    // the snapshot in this chunk has not been backed up
    // so we find the set of backed up blobs from the previous chunk
    const previousChunk = await chunkStore.loadAtVersion(
      projectId,
      lastBackedUpVersion,
      { persistedOnly: true }
    )
    const previousChunkHistory = previousChunk.getHistory()
    previousChunkHistory.findBlobHashes(seenBlobs)
  }
}

/**
 * Records blob hashes that have been previously seen in a chunk's history.
 *
 * @param {Object} chunk - The chunk containing history data
 * @param {number} currentBackedUpVersion - The version number that has been backed up
 * @param {Set<string>} seenBlobs - Set to collect previously seen blob hashes
 * @returns {void}
 */
function recordPreviouslySeenBlobs(chunk, currentBackedUpVersion, seenBlobs) {
  // We need to look at the chunk and decide how far we have backed up.
  // If we have not backed up this chunk at all, we need to backup the blobs
  // in the snapshot. Otherwise we need to backup the blobs in the changes
  // that have occurred since the last backup.
  const history = chunk.getHistory()
  const startVersion = chunk.getStartVersion()
  if (currentBackedUpVersion === 0) {
    // If we have only backed up version 0 (i.e. the first change)
    // then that includes the initial snapshot, so we consider
    // the blobs of the initial snapshot as seen.  If the project
    // has not been backed up at all then currentBackedUpVersion
    // will be undefined.
    history.snapshot.findBlobHashes(seenBlobs)
  } else if (currentBackedUpVersion > startVersion) {
    history.snapshot.findBlobHashes(seenBlobs)
    for (let i = 0; i < currentBackedUpVersion - startVersion; i++) {
      history.changes[i].findBlobHashes(seenBlobs)
    }
  }
}

/**
 * Collects new blob objects that need to be backed up from a given chunk.
 *
 * @param {Object} chunk - The chunk object containing history data
 * @param {Object} blobStore - Storage interface for retrieving blobs
 * @param {Set<string>} seenBlobs - Set of blob hashes that have already been processed
 * @returns {Promise<Object[]>} Array of blob objects that need to be backed up
 * @throws {Error} If blob retrieval fails
 */
async function collectNewBlobsForBackup(chunk, blobStore, seenBlobs) {
  /** @type {Set<string>} */
  const blobHashes = new Set()
  const history = chunk.getHistory()
  // Get all the blobs in this chunk, then exclude the seenBlobs and global blobs
  history.findBlobHashes(blobHashes)
  const blobsToBackup = await blobStore.getBlobs(
    [...blobHashes].filter(
      hash =>
        hash &&
        !seenBlobs.has(hash) &&
        (!GLOBAL_BLOBS.has(hash) || GLOBAL_BLOBS.get(hash).demoted)
    )
  )
  return blobsToBackup
}

/**
 * Asynchronously generates backups for a project based on provided versions.
 * @param {string} projectId - The ID of the project's history to back up.
 * @param {number} lastBackedUpVersion - The last version that was successfully backed up.
 * @yields {AsyncGenerator<{ chunkRecord: object, chunkToBackup: object, chunkBuffer: Buffer, blobsToBackup: object[] }>}
 *   Yields chunk records and corresponding data needed for backups.
 */
export async function* backupGenerator(projectId, lastBackedUpVersion) {
  assert.projectId(projectId, 'bad projectId')
  assert.maybe.integer(lastBackedUpVersion, 'bad lastBackedUpVersion')

  const blobStore = new BlobStore(projectId)

  /** @type {Set<string>} */
  const seenBlobs = new Set() // records the blobs that are already backed up

  const firstPendingVersion =
    lastBackedUpVersion >= 0 ? lastBackedUpVersion + 1 : 0
  let isStartingChunk = true
  let currentBackedUpVersion = lastBackedUpVersion
  const chunkRecordIterator = chunkStore.getProjectChunksFromVersion(
    projectId,
    firstPendingVersion
  )

  for await (const chunkRecord of chunkRecordIterator) {
    const { chunk, chunkBuffer } = await chunkStore.loadByChunkRecord(
      projectId,
      chunkRecord
    )

    if (isStartingChunk) {
      await lookBehindForSeenBlobs(
        projectId,
        chunkRecord,
        lastBackedUpVersion,
        seenBlobs
      )
      isStartingChunk = false
    }

    recordPreviouslySeenBlobs(chunk, currentBackedUpVersion, seenBlobs)

    const blobsToBackup = await collectNewBlobsForBackup(
      chunk,
      blobStore,
      seenBlobs
    )

    yield { chunkRecord, chunkToBackup: chunk, chunkBuffer, blobsToBackup }

    // After we generate a backup of this chunk, mark the backed up blobs as seen
    blobsToBackup.forEach(blob => seenBlobs.add(blob.getHash()))
    currentBackedUpVersion = chunkRecord.endVersion
  }
}

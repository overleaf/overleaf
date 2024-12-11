import { backupPersistor, projectBlobsBucket } from './backupPersistor.mjs'
import { makeProjectKey } from './blob_store/index.js'
import Stream from 'node:stream'
import fs from 'node:fs'
import Crypto from 'node:crypto'
import assert from './assert.js'
import { backedUpBlobs, projects } from './mongodb.js'
import { Binary } from 'mongodb'
import logger from '@overleaf/logger/logging-manager.js'
import { AlreadyWrittenError } from '@overleaf/object-persistor/src/Errors.js'

const HIGHWATER_MARK = 1024 * 1024

/**
 * Performs the actual upload of the blob to the backup storage.
 *
 * @param {string} projectId - The project ID of the project the blob belongs to (should have been converted from a postgres ID already if necessary)
 * @param {Blob} blob - The blob being uploaded
 * @param {string} path - The path to the file to upload (should have been stored on disk already)
 * @return {Promise<void>}
 */
export async function uploadBlobToBackup(projectId, blob, path) {
  const md5 = Crypto.createHash('md5')
  await Stream.promises.pipeline(fs.createReadStream(path), md5)
  const key = makeProjectKey(projectId, blob.getHash())
  const persistor = await backupPersistor.forProject(projectBlobsBucket, key)
  await persistor.sendStream(
    projectBlobsBucket,
    key,
    fs.createReadStream(path, { highWaterMark: HIGHWATER_MARK }),
    {
      contentType: 'application/octet-stream',
      contentLength: blob.getByteLength(),
      sourceMd5: md5.digest('hex'),
      ifNoneMatch: '*',
    }
  )
}

/**
 * Converts a legacy (postgres) historyId to a mongo projectId
 *
 * @param {string} historyId
 * @return {Promise<string>}
 * @private
 */
async function _convertLegacyHistoryIdToProjectId(historyId) {
  const project = await projects.findOne(
    { 'overleaf.history.id': parseInt(historyId) },
    { projection: { _id: 1 } }
  )

  if (!project?._id) {
    throw new Error('Did not find project for history id')
  }

  return project?._id?.toString()
}

/**
 * Records that a blob was backed up for a project.
 *
 * @param {string} projectId - projectId for a project (mongo format)
 * @param {string} hash
 * @return {Promise<void>}
 */
async function storeBlobBackup(projectId, hash) {
  await backedUpBlobs.updateOne(
    { _id: projectId },
    { $addToSet: { blobs: new Binary(Buffer.from(hash, 'hex')) } },
    { upsert: true }
  )
}

export async function _blobIsBackedUp(projectId, hash) {
  const backedUpBlobsForProject = await backedUpBlobs.findOne(
    {
      _id: projectId,
    },
    { blobs: 1 }
  )
  return backedUpBlobsForProject?.blobs?.some(b =>
    b.buffer.equals(Buffer.from(hash, 'hex'))
  )
}

/**
 * Back up a blob to the global storage and record that it was backed up.
 *
 * @param {string} historyId - history ID for a project (can be postgres format or mongo format)
 * @param {Blob} blob - The blob that is being backed up
 * @param {string} tmpPath - The path to a temporary file storing the contents of the blob.
 * @return {Promise<void>}
 */
export async function backupBlob(historyId, blob, tmpPath) {
  const hash = blob.getHash()

  let projectId = historyId
  if (assert.POSTGRES_ID_REGEXP.test(historyId)) {
    projectId = await _convertLegacyHistoryIdToProjectId(historyId)
  }

  try {
    if (await _blobIsBackedUp(projectId, hash)) {
      logger.debug(
        { projectId, hash },
        'Blob already backed up - skipping backup'
      )
      return
    }
  } catch (error) {
    logger.warn({ error }, 'Failed to check if blob is backed up')
    // We'll try anyway - we'll catch the error if it was backed up
  }

  try {
    logger.debug({ projectId, hash }, 'Starting blob backup')
    await uploadBlobToBackup(projectId, blob, tmpPath)
    await storeBlobBackup(projectId, hash)
  } catch (error) {
    if (error instanceof AlreadyWrittenError) {
      logger.debug({ error, projectId, hash }, 'Blob already backed up')
      // record that we backed it up already
      await storeBlobBackup(projectId, hash)
      return
    }
    // eventually queue this for retry - for now this will be fixed by running the script
    logger.warn({ error, projectId, hash }, 'Failed to upload blob to backup')
  } finally {
    logger.debug({ projectId, hash }, 'Ended blob backup')
  }
}

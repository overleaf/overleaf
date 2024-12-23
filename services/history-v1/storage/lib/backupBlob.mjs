// @ts-check
import { backupPersistor, projectBlobsBucket } from './backupPersistor.mjs'
import { GLOBAL_BLOBS, makeProjectKey } from './blob_store/index.js'
import Stream from 'node:stream'
import fs from 'node:fs'
import Crypto from 'node:crypto'
import assert from './assert.js'
import { backedUpBlobs, projects } from './mongodb.js'
import { Binary, ObjectId } from 'mongodb'
import logger from '@overleaf/logger/logging-manager.js'
import { AlreadyWrittenError } from '@overleaf/object-persistor/src/Errors.js'
import metrics from '@overleaf/metrics'

const HIGHWATER_MARK = 1024 * 1024

/**
 * @typedef {import("overleaf-editor-core").Blob} Blob
 */

/**
 * Increment a metric to record the outcome of a backup operation.
 *
 * @param {"success"|"failure"|"skipped"} status
 * @param {"global"|"already_backed_up"|"none"} reason
 */
function recordBackupConclusion(status, reason = 'none') {
  metrics.inc('blob_backed_up', 1, { status, reason })
}

/**
 * Performs the actual upload of the blob to the backup storage.
 *
 * @param {string} historyId - The history ID of the project the blob belongs to
 * @param {Blob} blob - The blob being uploaded
 * @param {string} path - The path to the file to upload (should have been stored on disk already)
 * @return {Promise<void>}
 */
export async function uploadBlobToBackup(historyId, blob, path) {
  const md5 = Crypto.createHash('md5')
  await Stream.promises.pipeline(fs.createReadStream(path), md5)
  const key = makeProjectKey(historyId, blob.getHash())
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
    { _id: new ObjectId(projectId) },
    { $addToSet: { blobs: new Binary(Buffer.from(hash, 'hex')) } },
    { upsert: true }
  )
}

/**
 * Determine whether a specific blob has been backed up in this project.
 *
 * @param {string} projectId
 * @param {string} hash
 * @return {Promise<*>}
 * @private
 */
export async function _blobIsBackedUp(projectId, hash) {
  const blobs = await backedUpBlobs.findOne(
    {
      _id: new ObjectId(projectId),
      blobs: new Binary(Buffer.from(hash, 'hex')),
    },
    { projection: { _id: 1 } }
  )
  return blobs?._id
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

  const globalBlob = GLOBAL_BLOBS.get(hash)

  if (globalBlob && !globalBlob.demoted) {
    recordBackupConclusion('skipped', 'global')
    logger.debug({ projectId, hash }, 'Blob is global - skipping backup')
    return
  }

  try {
    if (await _blobIsBackedUp(projectId, hash)) {
      recordBackupConclusion('skipped', 'already_backed_up')
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
    await uploadBlobToBackup(historyId, blob, tmpPath)
    await storeBlobBackup(projectId, hash)
    recordBackupConclusion('success')
  } catch (error) {
    if (error instanceof AlreadyWrittenError) {
      logger.debug({ error, projectId, hash }, 'Blob already backed up')
      // record that we backed it up already
      await storeBlobBackup(projectId, hash)
      recordBackupConclusion('failure', 'already_backed_up')
      return
    }
    // eventually queue this for retry - for now this will be fixed by running the script
    recordBackupConclusion('failure')
    logger.warn({ error, projectId, hash }, 'Failed to upload blob to backup')
  } finally {
    logger.debug({ projectId, hash }, 'Ended blob backup')
  }
}

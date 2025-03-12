// @ts-check

import logger from '@overleaf/logger'
import commandLineArgs from 'command-line-args'
import { History } from 'overleaf-editor-core'
import { getProjectChunks, loadLatestRaw } from '../lib/chunk_store/index.js'
import { client } from '../lib/mongodb.js'
import knex from '../lib/knex.js'
import { historyStore } from '../lib/history_store.js'
import pLimit from 'p-limit'
import {
  GLOBAL_BLOBS,
  loadGlobalBlobs,
  makeProjectKey,
  BlobStore,
} from '../lib/blob_store/index.js'
import {
  listPendingBackups,
  getBackupStatus,
  setBackupVersion,
  updateCurrentMetadataIfNotSet,
  updatePendingChangeTimestamp,
  getBackedUpBlobHashes,
  unsetBackedUpBlobHashes,
} from '../lib/backup_store/index.js'
import { backupBlob, downloadBlobToDir } from '../lib/backupBlob.mjs'
import {
  backupPersistor,
  chunksBucket,
  projectBlobsBucket,
} from '../lib/backupPersistor.mjs'
import { backupGenerator } from '../lib/backupGenerator.mjs'
import { promises as fs, createWriteStream } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import projectKey from '../lib/project_key.js'
import Crypto from 'node:crypto'
import Stream from 'node:stream'
import { EventEmitter } from 'node:events'
import {
  objectIdFromInput,
  batchedUpdate,
  READ_PREFERENCE_SECONDARY,
} from '@overleaf/mongo-utils/batchedUpdate.js'
import { createGunzip } from 'node:zlib'
import { text } from 'node:stream/consumers'
import { fromStream as blobHashFromStream } from '../lib/blob_hash.js'
import { NotFoundError } from '@overleaf/object-persistor/src/Errors.js'

// Create a singleton promise that loads global blobs once
let globalBlobsPromise = null
function ensureGlobalBlobsLoaded() {
  if (!globalBlobsPromise) {
    globalBlobsPromise = loadGlobalBlobs()
  }
  return globalBlobsPromise
}

EventEmitter.defaultMaxListeners = 20

logger.initialize('history-v1-backup')

// Settings shared between command-line and module usage
let DRY_RUN = false
let RETRY_LIMIT = 3
const RETRY_DELAY = 1000
let CONCURRENCY = 4
let BATCH_CONCURRENCY = 1
let BLOB_LIMITER = pLimit(CONCURRENCY)
let USE_SECONDARY = false

/**
 * Configure backup settings
 * @param {Object} options Backup configuration options
 */
export function configureBackup(options = {}) {
  DRY_RUN = options.dryRun || false
  RETRY_LIMIT = options.retries || 3
  CONCURRENCY = options.concurrency || 1
  BATCH_CONCURRENCY = options.batchConcurrency || 1
  BLOB_LIMITER = pLimit(CONCURRENCY)
  USE_SECONDARY = options.useSecondary || false
}

let gracefulShutdownInitiated = false

process.on('SIGINT', handleSignal)
process.on('SIGTERM', handleSignal)

function handleSignal() {
  gracefulShutdownInitiated = true
  logger.info({}, 'graceful shutdown initiated, draining queue')
}

async function retry(fn, times, delayMs) {
  let attempts = times
  while (attempts > 0) {
    try {
      const result = await fn()
      return result
    } catch (err) {
      attempts--
      if (attempts === 0) throw err
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
}

function wrapWithRetry(fn, retries, delayMs) {
  return async (...args) => {
    const result = await retry(() => fn(...args), retries, delayMs)
    return result
  }
}

const downloadWithRetry = wrapWithRetry(
  downloadBlobToDir,
  RETRY_LIMIT,
  RETRY_DELAY
)
// FIXME: this creates a new backupPersistor for each blob
// so there is no caching of the DEK
const backupWithRetry = wrapWithRetry(backupBlob, RETRY_LIMIT, RETRY_DELAY)

async function findNewBlobs(projectId, blobs) {
  const newBlobs = []
  const existingBackedUpBlobHashes = await getBackedUpBlobHashes(projectId)
  for (const blob of blobs) {
    const hash = blob.getHash()
    if (existingBackedUpBlobHashes.has(blob.getHash())) {
      logger.debug({ projectId, hash }, 'Blob is already backed up, skipping')
      continue
    }
    const globalBlob = GLOBAL_BLOBS.get(hash)
    if (globalBlob && !globalBlob.demoted) {
      logger.debug(
        { projectId, hash },
        'Blob is a global blob and not demoted, skipping'
      )
      continue
    }
    newBlobs.push(blob)
  }
  return newBlobs
}

async function cleanBackedUpBlobs(projectId, blobs) {
  const hashes = blobs.map(blob => blob.getHash())
  if (DRY_RUN) {
    console.log(
      'Would remove blobs',
      hashes.join(' '),
      'from project',
      projectId
    )
    return
  }
  await unsetBackedUpBlobHashes(projectId, hashes)
}

async function backupSingleBlob(projectId, historyId, blob, tmpDir, persistor) {
  if (DRY_RUN) {
    console.log(
      'Would back up blob',
      JSON.stringify(blob),
      'in history',
      historyId,
      'for project',
      projectId
    )
    return
  }
  logger.debug({ blob, historyId }, 'backing up blob')
  const blobPath = await downloadWithRetry(historyId, blob, tmpDir)
  await backupWithRetry(historyId, blob, blobPath, persistor)
}

async function backupBlobs(projectId, historyId, blobs, limiter, persistor) {
  let tmpDir
  try {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'blob-backup-'))

    const blobBackupOperations = blobs.map(blob =>
      limiter(backupSingleBlob, projectId, historyId, blob, tmpDir, persistor)
    )

    // Reject if any blob backup fails
    await Promise.all(blobBackupOperations)
  } finally {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  }
}

async function backupChunk(
  projectId,
  historyId,
  chunkBackupPersistorForProject,
  chunkToBackup,
  chunkRecord,
  chunkBuffer
) {
  if (DRY_RUN) {
    console.log(
      'Would back up chunk',
      JSON.stringify(chunkRecord),
      'in history',
      historyId,
      'for project',
      projectId,
      'key',
      makeChunkKey(historyId, chunkToBackup.startVersion)
    )
    return
  }
  const key = makeChunkKey(historyId, chunkToBackup.startVersion)
  logger.debug({ chunkRecord, historyId, projectId, key }, 'backing up chunk')
  const md5 = Crypto.createHash('md5').update(chunkBuffer)
  await chunkBackupPersistorForProject.sendStream(
    chunksBucket,
    makeChunkKey(historyId, chunkToBackup.startVersion),
    Stream.Readable.from([chunkBuffer]),
    {
      contentType: 'application/json',
      contentEncoding: 'gzip',
      contentLength: chunkBuffer.byteLength,
      sourceMd5: md5.digest('hex'),
    }
  )
}

async function updateBackupStatus(
  projectId,
  lastBackedUpVersion,
  chunkRecord,
  startOfBackupTime
) {
  if (DRY_RUN) {
    console.log(
      'Would set backup version to',
      chunkRecord.endVersion,
      'with lastBackedUpTimestamp',
      startOfBackupTime
    )
    return
  }
  logger.debug(
    { projectId, chunkRecord, startOfBackupTime },
    'setting backupVersion and lastBackedUpTimestamp'
  )
  await setBackupVersion(
    projectId,
    lastBackedUpVersion,
    chunkRecord.endVersion,
    startOfBackupTime
  )
}

// Define command-line options
const optionDefinitions = [
  {
    name: 'projectId',
    alias: 'p',
    type: String,
    description: 'The ID of the project to backup',
    defaultOption: true,
  },
  {
    name: 'help',
    alias: 'h',
    type: Boolean,
    description: 'Display this usage guide.',
  },
  {
    name: 'status',
    alias: 's',
    type: Boolean,
    description: 'Display project status.',
  },
  {
    name: 'list',
    alias: 'l',
    type: Boolean,
    description: 'List projects that need to be backed up',
  },
  {
    name: 'dry-run',
    alias: 'n',
    type: Boolean,
    description: 'Perform a dry run without making any changes.',
  },
  {
    name: 'retries',
    alias: 'r',
    type: Number,
    description: 'Number of retries, default is 3.',
  },
  {
    name: 'concurrency',
    alias: 'c',
    type: Number,
    description: 'Number of concurrent blob downloads (default: 1)',
  },
  {
    name: 'batch-concurrency',
    alias: 'b',
    type: Number,
    description: 'Number of concurrent project operations (default: 1)',
  },
  {
    name: 'pending',
    alias: 'P',
    type: Boolean,
    description: 'Backup all pending projects.',
  },
  {
    name: 'interval',
    alias: 'i',
    type: Number,
    description: 'Time interval in seconds for pending backups (default: 3600)',
    defaultValue: 3600,
  },
  {
    name: 'init',
    alias: 'I',
    type: Boolean,
    description: 'Initialize backups for all projects.',
  },
  { name: 'output', alias: 'o', type: String, description: 'Output file' },
  {
    name: 'start-date',
    type: String,
    description: 'Start date for initialization (ISO format)',
  },
  {
    name: 'end-date',
    type: String,
    description: 'End date for initialization (ISO format)',
  },
  {
    name: 'use-secondary',
    type: Boolean,
    description: 'Use secondary read preference for backup status',
  },
  {
    name: 'compare',
    alias: 'C',
    type: Boolean,
    description:
      'Compare backup with original chunks. With --start-date and --end-date compares all projects in range.',
  },
]

function handleOptions() {
  const options = commandLineArgs(optionDefinitions)

  if (options.help) {
    console.log('Usage:')
    optionDefinitions.forEach(option => {
      console.log(`  --${option.name}, -${option.alias}: ${option.description}`)
    })
    process.exit(0)
  }

  const projectIdRequired =
    !options.list &&
    !options.pending &&
    !options.init &&
    !(options.compare && options['start-date'] && options['end-date'])

  if (projectIdRequired && !options.projectId) {
    console.error('Error: projectId is required')
    process.exit(1)
  }

  if (options.pending && options.projectId) {
    console.error('Error: --pending cannot be specified with projectId')
    process.exit(1)
  }

  if (options.pending && (options.list || options.status)) {
    console.error('Error: --pending is exclusive with --list and --status')
    process.exit(1)
  }

  if (options.init && options.pending) {
    console.error('Error: --init cannot be specified with --pending')
    process.exit(1)
  }

  if (
    (options['start-date'] || options['end-date']) &&
    !options.init &&
    !options.compare
  ) {
    console.error(
      'Error: date options can only be used with --init or --compare'
    )
    process.exit(1)
  }

  if (options['use-secondary']) {
    USE_SECONDARY = true
  }

  if (
    options.compare &&
    !options.projectId &&
    !(options['start-date'] && options['end-date'])
  ) {
    console.error(
      'Error: --compare requires either projectId or both --start-date and --end-date'
    )
    process.exit(1)
  }

  DRY_RUN = options['dry-run'] || false
  RETRY_LIMIT = options.retries || 3
  CONCURRENCY = options.concurrency || 1
  BATCH_CONCURRENCY = options['batch-concurrency'] || 1
  BLOB_LIMITER = pLimit(CONCURRENCY)
  return options
}

async function displayBackupStatus(projectId) {
  const result = await analyseBackupStatus(projectId)
  console.log('Backup status:', JSON.stringify(result))
}

async function analyseBackupStatus(projectId) {
  const { backupStatus, historyId, currentEndVersion, currentEndTimestamp } =
    await getBackupStatus(projectId)
  // TODO: when we have confidence that the latestChunkMetadata always matches
  // the values from the backupStatus we can skip loading it here
  const latestChunkMetadata = await loadLatestRaw(historyId, {
    readOnly: Boolean(USE_SECONDARY),
  })
  if (
    currentEndVersion &&
    currentEndVersion !== latestChunkMetadata.endVersion
  ) {
    // compare the current end version with the latest chunk metadata to check that
    // the updates to the project collection are reliable
    // expect some failures due to the time window between getBackupStatus and
    // loadLatestRaw where the project is being actively edited.
    logger.warn(
      {
        projectId,
        historyId,
        currentEndVersion,
        currentEndTimestamp,
        latestChunkMetadata,
      },
      'currentEndVersion does not match latest chunk metadata'
    )
  }

  if (DRY_RUN) {
    console.log('Project:', projectId)
    console.log('History ID:', historyId)
    console.log('Latest Chunk Metadata:', JSON.stringify(latestChunkMetadata))
    console.log('Current end version:', currentEndVersion)
    console.log('Current end timestamp:', currentEndTimestamp)
    console.log('Backup status:', backupStatus ?? 'none')
  }
  if (!backupStatus) {
    if (DRY_RUN) {
      console.log('No backup status found - doing full backup')
    }
  }
  const lastBackedUpVersion = backupStatus?.lastBackedUpVersion
  const endVersion = latestChunkMetadata.endVersion
  if (endVersion >= 0 && endVersion === lastBackedUpVersion) {
    if (DRY_RUN) {
      console.log(
        'Project is up to date, last backed up at version',
        lastBackedUpVersion
      )
    }
  } else if (endVersion < lastBackedUpVersion) {
    throw new Error('backup is ahead of project')
  } else {
    if (DRY_RUN) {
      console.log(
        'Project needs to be backed up from',
        lastBackedUpVersion,
        'to',
        endVersion
      )
    }
  }

  return {
    historyId,
    lastBackedUpVersion,
    currentVersion: latestChunkMetadata.endVersion || 0,
    upToDate: endVersion >= 0 && lastBackedUpVersion === endVersion,
    pendingChangeAt: backupStatus?.pendingChangeAt,
    currentEndVersion,
    currentEndTimestamp,
    latestChunkMetadata,
  }
}

async function displayPendingBackups(options) {
  const intervalMs = options.interval * 1000
  for await (const project of listPendingBackups(intervalMs)) {
    console.log(
      'Project:',
      project._id.toHexString(),
      'backup status:',
      JSON.stringify(project.overleaf.backup),
      'history status:',
      JSON.stringify(project.overleaf.history, [
        'currentEndVersion',
        'currentEndTimestamp',
      ])
    )
  }
}

function makeChunkKey(projectId, startVersion) {
  return path.join(projectKey.format(projectId), projectKey.pad(startVersion))
}

export async function backupProject(projectId, options) {
  if (gracefulShutdownInitiated) {
    return
  }
  await ensureGlobalBlobsLoaded()
  // FIXME: flush the project first!
  // Let's assume the the flush happens externally and triggers this backup
  const backupStartTime = new Date()
  // find the last backed up version
  const {
    historyId,
    lastBackedUpVersion,
    currentVersion,
    upToDate,
    pendingChangeAt,
    currentEndVersion,
    latestChunkMetadata,
  } = await analyseBackupStatus(projectId)

  if (upToDate) {
    logger.debug(
      {
        projectId,
        historyId,
        lastBackedUpVersion,
        currentVersion,
        pendingChangeAt,
      },
      'backup is up to date'
    )

    if (
      currentEndVersion === undefined &&
      latestChunkMetadata.endVersion >= 0
    ) {
      if (DRY_RUN) {
        console.log('Would update current metadata to', latestChunkMetadata)
      } else {
        await updateCurrentMetadataIfNotSet(projectId, latestChunkMetadata)
      }
    }

    // clear the pending changes timestamp if the backup is complete
    if (pendingChangeAt) {
      if (DRY_RUN) {
        console.log(
          'Would update or clear pending changes timestamp',
          backupStartTime
        )
      } else {
        await updatePendingChangeTimestamp(projectId, backupStartTime)
      }
    }
    return
  }

  logger.debug(
    {
      projectId,
      historyId,
      lastBackedUpVersion,
      currentVersion,
      pendingChangeAt,
    },
    'backing up project'
  )

  // this persistor works for both the chunks and blobs buckets,
  // because they use the same DEK
  const backupPersistorForProject = await backupPersistor.forProject(
    chunksBucket,
    makeProjectKey(historyId, '')
  )

  let previousBackedUpVersion = lastBackedUpVersion
  const backupVersions = [previousBackedUpVersion]

  for await (const {
    blobsToBackup,
    chunkToBackup,
    chunkRecord,
    chunkBuffer,
  } of backupGenerator(historyId, lastBackedUpVersion)) {
    // backup the blobs first
    // this can be done in parallel but must fail if any blob cannot be backed up
    // if the blob already exists in the backup then that is allowed
    const newBlobs = await findNewBlobs(projectId, blobsToBackup)

    await backupBlobs(
      projectId,
      historyId,
      newBlobs,
      BLOB_LIMITER,
      backupPersistorForProject
    )

    // then backup the original compressed chunk using the startVersion as the key
    await backupChunk(
      projectId,
      historyId,
      backupPersistorForProject,
      chunkToBackup,
      chunkRecord,
      chunkBuffer
    )

    // persist the backup status in mongo for the current chunk
    try {
      await updateBackupStatus(
        projectId,
        previousBackedUpVersion,
        chunkRecord,
        backupStartTime
      )
    } catch (err) {
      logger.error(
        { projectId, chunkRecord, err, backupVersions },
        'error updating backup status'
      )
      throw err
    }

    previousBackedUpVersion = chunkRecord.endVersion
    backupVersions.push(previousBackedUpVersion)

    await cleanBackedUpBlobs(projectId, blobsToBackup)
  }

  // update the current end version and timestamp if they are not set
  if (currentEndVersion === undefined && latestChunkMetadata.endVersion >= 0) {
    if (DRY_RUN) {
      console.log('Would update current metadata to', latestChunkMetadata)
    } else {
      await updateCurrentMetadataIfNotSet(projectId, latestChunkMetadata)
    }
  }

  // clear the pending changes timestamp if the backup is complete, otherwise set it to the time
  // when the backup started (to pick up the new changes on the next backup)
  if (DRY_RUN) {
    console.log(
      'Would update or clear pending changes timestamp',
      backupStartTime
    )
  } else {
    await updatePendingChangeTimestamp(projectId, backupStartTime)
  }
}

function convertToISODate(dateStr) {
  // Expecting YYYY-MM-DD format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error('Date must be in YYYY-MM-DD format')
  }
  return new Date(dateStr + 'T00:00:00.000Z').toISOString()
}

export async function initializeProjects(options) {
  await ensureGlobalBlobsLoaded()
  let totalErrors = 0
  let totalProjects = 0

  const query = {
    'overleaf.backup.lastBackedUpVersion': { $in: [null] },
  }

  if (options['start-date'] && options['end-date']) {
    query._id = {
      $gte: objectIdFromInput(convertToISODate(options['start-date'])),
      $lt: objectIdFromInput(convertToISODate(options['end-date'])),
    }
  }

  const cursor = client
    .db()
    .collection('projects')
    .find(query, {
      projection: { _id: 1 },
      readPreference: READ_PREFERENCE_SECONDARY,
    })

  if (options.output) {
    console.log("Writing project IDs to file: '" + options.output + "'")
    const output = createWriteStream(options.output)
    for await (const project of cursor) {
      output.write(project._id.toHexString() + '\n')
      totalProjects++
    }
    output.end()
    console.log('Wrote ' + totalProjects + ' project IDs to file')
    return
  }

  for await (const project of cursor) {
    if (gracefulShutdownInitiated) {
      console.warn('graceful shutdown: stopping project initialization')
      break
    }
    totalProjects++
    const projectId = project._id.toHexString()
    try {
      await backupProject(projectId, options)
    } catch (err) {
      totalErrors++
      logger.error({ projectId, err }, 'error backing up project')
    }
  }

  return { errors: totalErrors, projects: totalProjects }
}

async function backupPendingProjects(options) {
  const intervalMs = options.interval * 1000
  for await (const project of listPendingBackups(intervalMs)) {
    if (gracefulShutdownInitiated) {
      console.warn('graceful shutdown: stopping pending project backups')
      break
    }
    const projectId = project._id.toHexString()
    console.log(`Backing up pending project with ID: ${projectId}`)
    await backupProject(projectId, options)
  }
}

class BlobComparator {
  constructor(backupPersistorForProject) {
    this.cache = new Map()
    this.backupPersistorForProject = backupPersistorForProject
  }

  async compareBlob(historyId, blob) {
    let computedHash = this.cache.get(blob.hash)
    const fromCache = !!computedHash

    if (!computedHash) {
      const blobKey = makeProjectKey(historyId, blob.hash)
      const backupBlobStream =
        await this.backupPersistorForProject.getObjectStream(
          projectBlobsBucket,
          blobKey,
          { autoGunzip: true }
        )
      computedHash = await blobHashFromStream(blob.byteLength, backupBlobStream)
      this.cache.set(blob.hash, computedHash)
    }

    const matches = computedHash === blob.hash
    return {
      matches,
      computedHash,
      fromCache,
    }
  }
}

async function compareBackups(projectId, options) {
  console.log(`Comparing backups for project ${projectId}`)
  const { historyId } = await getBackupStatus(projectId)
  const chunks = await getProjectChunks(historyId)
  const blobStore = new BlobStore(historyId)
  const backupPersistorForProject = await backupPersistor.forProject(
    chunksBucket,
    makeProjectKey(historyId, '')
  )

  let totalChunkMatches = 0
  let totalChunkMismatches = 0
  let totalChunksNotFound = 0
  let totalBlobMatches = 0
  let totalBlobMismatches = 0
  let totalBlobsNotFound = 0
  const errors = []
  const blobComparator = new BlobComparator(backupPersistorForProject)

  for (const chunk of chunks) {
    try {
      // Compare chunk content
      const originalChunk = await historyStore.loadRaw(historyId, chunk.id)
      const key = makeChunkKey(historyId, chunk.startVersion)
      try {
        const backupChunkStream =
          await backupPersistorForProject.getObjectStream(chunksBucket, key)
        const backupStr = await text(backupChunkStream.pipe(createGunzip()))
        const originalStr = JSON.stringify(originalChunk)
        const backupChunk = JSON.parse(backupStr)
        const backupStartVersion = chunk.startVersion
        const backupEndVersion = chunk.startVersion + backupChunk.changes.length

        if (originalStr === backupStr) {
          console.log(
            `✓ Chunk ${chunk.id} (v${chunk.startVersion}-v${chunk.endVersion}) matches`
          )
          totalChunkMatches++
        } else if (originalStr === JSON.stringify(JSON.parse(backupStr))) {
          console.log(
            `✓ Chunk ${chunk.id} (v${chunk.startVersion}-v${chunk.endVersion}) matches (after normalisation)`
          )
          totalChunkMatches++
        } else if (backupEndVersion < chunk.endVersion) {
          console.log(
            `✗ Chunk ${chunk.id} is ahead of backup (v${chunk.startVersion}-v${chunk.endVersion} vs v${backupStartVersion}-v${backupEndVersion})`
          )
          totalChunkMismatches++
          errors.push({ chunkId: chunk.id, error: 'Chunk ahead of backup' })
        } else {
          console.log(
            `✗ Chunk ${chunk.id} (v${chunk.startVersion}-v${chunk.endVersion}) MISMATCH`
          )
          totalChunkMismatches++
          errors.push({ chunkId: chunk.id, error: 'Chunk mismatch' })
        }
      } catch (err) {
        if (err instanceof NotFoundError) {
          console.log(`✗ Chunk ${chunk.id} not found in backup`, err.cause)
          totalChunksNotFound++
          errors.push({ chunkId: chunk.id, error: `Chunk not found` })
        } else {
          throw err
        }
      }

      const history = History.fromRaw(originalChunk)

      // Compare blobs in chunk
      const blobHashes = new Set()
      history.findBlobHashes(blobHashes)
      const blobs = await blobStore.getBlobs(Array.from(blobHashes))
      for (const blob of blobs) {
        if (GLOBAL_BLOBS.has(blob.hash)) {
          const globalBlob = GLOBAL_BLOBS.get(blob.hash)
          console.log(
            `  ✓ Blob ${blob.hash} is a global blob`,
            globalBlob.demoted ? '(demoted)' : ''
          )
          continue
        }
        try {
          const { matches, computedHash, fromCache } =
            await blobComparator.compareBlob(historyId, blob)

          if (matches) {
            console.log(
              `  ✓ Blob ${blob.hash} hash matches (${blob.byteLength} bytes)` +
                (fromCache ? ' (from cache)' : '')
            )
            totalBlobMatches++
          } else {
            console.log(
              `  ✗ Blob ${blob.hash} hash mismatch (original: ${blob.hash}, backup: ${computedHash}) (${blob.byteLength} bytes, ${blob.stringLength} string length)` +
                (fromCache ? ' (from cache)' : '')
            )
            totalBlobMismatches++
            errors.push({
              chunkId: chunk.id,
              error: `Blob ${blob.hash} hash mismatch`,
            })
          }
        } catch (err) {
          if (err instanceof NotFoundError) {
            console.log(`  ✗ Blob ${blob.hash} not found in backup`, err.cause)
            totalBlobsNotFound++
            errors.push({
              chunkId: chunk.id,
              error: `Blob ${blob.hash} not found`,
            })
          } else {
            throw err
          }
        }
      }
    } catch (err) {
      console.error(`Error comparing chunk ${chunk.id}:`, err)
      errors.push({ chunkId: chunk.id, error: err })
    }
  }

  // Print summary
  console.log('\nComparison Summary:')
  console.log('==================')
  console.log(`Total chunks: ${chunks.length}`)
  console.log(`Chunk matches: ${totalChunkMatches}`)
  console.log(`Chunk mismatches: ${totalChunkMismatches}`)
  console.log(`Chunk not found: ${totalChunksNotFound}`)
  console.log(`Blob matches: ${totalBlobMatches}`)
  console.log(`Blob mismatches: ${totalBlobMismatches}`)
  console.log(`Blob not found: ${totalBlobsNotFound}`)
  console.log(`Errors: ${errors.length}`)

  if (errors.length > 0) {
    console.log('\nErrors:')
    errors.forEach(({ chunkId, error }) => {
      console.log(`  Chunk ${chunkId}: ${error}`)
    })
    throw new Error('Backup comparison FAILED')
  } else {
    console.log('Backup comparison successful')
  }
}

async function compareAllProjects(options) {
  const limiter = pLimit(BATCH_CONCURRENCY)
  let totalErrors = 0
  let totalProjects = 0

  async function processBatch(batch) {
    if (gracefulShutdownInitiated) {
      throw new Error('graceful shutdown')
    }
    const batchOperations = batch.map(project =>
      limiter(async () => {
        const projectId = project._id.toHexString()
        totalProjects++
        try {
          console.log(`\nComparing project ${projectId} (${totalProjects})`)
          await compareBackups(projectId, options)
        } catch (err) {
          totalErrors++
          console.error(`Failed to compare project ${projectId}:`, err)
        }
      })
    )
    await Promise.allSettled(batchOperations)
  }

  const query = {
    'overleaf.history.id': { $exists: true },
    'overleaf.backup.lastBackedUpVersion': { $exists: true },
  }

  await batchedUpdate(
    client.db().collection('projects'),
    query,
    processBatch,
    {
      _id: 1,
      'overleaf.history': 1,
      'overleaf.backup': 1,
    },
    { readPreference: 'secondary' },
    {
      BATCH_RANGE_START: convertToISODate(options['start-date']),
      BATCH_RANGE_END: convertToISODate(options['end-date']),
    }
  )

  console.log('\nComparison Summary:')
  console.log('==================')
  console.log(`Total projects processed: ${totalProjects}`)
  console.log(`Projects with errors: ${totalErrors}`)

  if (totalErrors > 0) {
    throw new Error('Some project comparisons failed')
  }
}

async function main() {
  const options = handleOptions()
  await ensureGlobalBlobsLoaded()
  const projectId = options.projectId

  if (options.status) {
    await displayBackupStatus(projectId)
  } else if (options.list) {
    await displayPendingBackups(options)
  } else if (options.pending) {
    await backupPendingProjects(options)
  } else if (options.init) {
    await initializeProjects(options)
  } else if (options.compare) {
    if (options['start-date'] && options['end-date']) {
      await compareAllProjects(options)
    } else {
      await compareBackups(projectId, options)
    }
  } else {
    await backupProject(projectId, options)
  }
}

// Only run command-line interface when script is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => {
      console.log(
        gracefulShutdownInitiated ? 'Exited - graceful shutdown' : 'Completed'
      )
    })
    .catch(err => {
      console.error('Error backing up project:', err)
      process.exit(1)
    })
    .finally(() => {
      knex
        .destroy()
        .then(() => {
          console.log('Postgres connection closed')
        })
        .catch(err => {
          console.error('Error closing Postgres connection:', err)
        })
      client
        .close()
        .then(() => {
          console.log('MongoDB connection closed')
        })
        .catch(err => {
          console.error('Error closing MongoDB connection:', err)
        })
    })
}

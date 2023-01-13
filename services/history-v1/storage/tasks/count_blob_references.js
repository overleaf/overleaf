#!/usr/bin/env node

'use strict'

/**
 * This script fetches all history chunks from active projects (as listed in the
 * active_doc_ids table) and counts how many times each blob is referenced. The
 * reference count is stored in the blobs.estimated_reference_count column.
 */

const Path = require('path')
const BPromise = require('bluebird')
const commandLineArgs = require('command-line-args')
const config = require('config')
const stringToStream = require('string-to-stream')

const { History, EditFileOperation } = require('overleaf-editor-core')
const { knex, historyStore, persistor } = require('..')

const DEFAULT_BATCH_SIZE = 100
const DEFAULT_TIMEOUT = 23 * 60 * 60 // 23 hours
const MAX_POSTGRES_INTEGER = 2147483647
const TEXT_OPERATION_COUNT_THRESHOLD = 500
const BUCKET = config.get('analytics.bucket')
const BLOB_REFERENCE_COUNTS_PREFIX = 'blob-reference-counts/batches/'
const TEXT_OPERATION_COUNTS_PREFIX = 'text-operation-counts/'

async function main() {
  const programName = Path.basename(process.argv[1])
  const options = commandLineArgs([
    { name: 'restart', type: Boolean },
    { name: 'continue', type: Boolean },
    { name: 'batch-size', type: Number, defaultValue: DEFAULT_BATCH_SIZE },
    { name: 'timeout', type: Number, defaultValue: DEFAULT_TIMEOUT },
    { name: 'concurrency', type: Number, defaultValue: 1 },
    { name: 'min-doc-id', type: Number, defaultValue: 1 },
    { name: 'max-doc-id', type: Number, defaultValue: MAX_POSTGRES_INTEGER },
  ])
  const minDocId = options['min-doc-id']
  const maxDocId = options['max-doc-id']
  const runOptions = {
    batchSize: options['batch-size'],
    timeout: options.timeout,
    concurrency: options.concurrency,
  }
  const inProgress = await isRunInProgress()
  if (inProgress && !options.restart && !options.continue) {
    console.log(`\
A blob reference count is already under way.

To resume this run, use: ${programName} --continue
To start a new run, use: ${programName} --restart`)
    return
  }
  if (!inProgress || options.restart) {
    await initialize()
  }
  const nextDocId = await getNextDocId(minDocId, maxDocId)
  await run(nextDocId, maxDocId, runOptions)
}

async function isRunInProgress() {
  const record = await knex('blob_reference_count_batches').first()
  return record != null
}

async function getNextDocId(minDocId, maxDocId) {
  const { lastDocId } = await knex('blob_reference_count_batches')
    .where('end_doc_id', '<=', maxDocId)
    .max({ lastDocId: 'end_doc_id' })
    .first()
  if (lastDocId == null) {
    return minDocId
  } else {
    return Math.max(minDocId, lastDocId + 1)
  }
}

async function initialize() {
  await persistor.deleteDirectory(BUCKET, BLOB_REFERENCE_COUNTS_PREFIX)
  await persistor.deleteDirectory(BUCKET, TEXT_OPERATION_COUNTS_PREFIX)
  await knex('blob_reference_count_batches').truncate()
}

async function run(startDocId, maxDocId, options) {
  const { timeout, batchSize, concurrency } = options
  const maxRunningTime = Date.now() + timeout * 1000
  let batchStart = startDocId
  while (true) {
    if (Date.now() > maxRunningTime) {
      console.log('Timeout exceeded. Exiting early.')
      break
    }
    const docIds = await getDocIds(batchStart, maxDocId, batchSize)
    if (docIds.length === 0) {
      console.log('No more projects to process. Bye!')
      break
    }
    const batchEnd = docIds[docIds.length - 1]
    console.log(`Processing doc ids ${batchStart} to ${batchEnd}...`)
    const chunks = await getChunks(docIds)
    const blobReferenceCounter = new BlobReferenceCounter()
    const textOperationCounter = new TextOperationCounter()
    await BPromise.map(
      chunks,
      async chunk => {
        const history = await getHistory(chunk)
        blobReferenceCounter.processHistory(history, chunk.projectId)
        textOperationCounter.processHistory(history, chunk.projectId)
      },
      { concurrency }
    )
    await storeBlobReferenceCounts(batchStart, blobReferenceCounter.getCounts())
    await storeTextOperationCounts(batchStart, textOperationCounter.getCounts())
    await recordBatch(batchStart, batchEnd)
    batchStart = batchEnd + 1
  }
}

async function getDocIds(minDocId, maxDocId, batchSize) {
  const docIds = await knex('active_doc_ids')
    .select('doc_id')
    .where('doc_id', '>=', minDocId)
    .andWhere('doc_id', '<=', maxDocId)
    .orderBy('doc_id')
    .limit(batchSize)
    .pluck('doc_id')
  return docIds
}

async function getChunks(docIds) {
  const chunks = await knex('chunks')
    .select('id', { projectId: 'doc_id' })
    .where('doc_id', 'in', docIds)
  return chunks
}

async function recordBatch(batchStart, batchEnd) {
  await knex('blob_reference_count_batches').insert({
    start_doc_id: batchStart,
    end_doc_id: batchEnd,
  })
}

async function getHistory(chunk) {
  const rawHistory = await historyStore.loadRaw(chunk.projectId, chunk.id)
  const history = History.fromRaw(rawHistory)
  return history
}

async function storeBlobReferenceCounts(startDocId, counts) {
  const key = `${BLOB_REFERENCE_COUNTS_PREFIX}${startDocId}.csv`
  const csv = makeCsvFromMap(counts)
  const stream = stringToStream(csv)
  persistor.sendStream(BUCKET, key, stream)
}

async function storeTextOperationCounts(startDocId, counts) {
  const key = `${TEXT_OPERATION_COUNTS_PREFIX}${startDocId}.csv`
  const csv = makeCsvFromMap(counts)
  const stream = stringToStream(csv)
  await persistor.sendStream(BUCKET, key, stream)
}

function makeCsvFromMap(map) {
  const entries = Array.from(map.entries())
  entries.sort((a, b) => {
    if (a[0] < b[0]) {
      return -1
    }
    if (a[0] > b[0]) {
      return 1
    }
    return 0
  })
  return entries.map(entry => entry.join(',')).join('\n')
}

function incrementMapEntry(map, key) {
  const currentCount = map.get(key) || 0
  map.set(key, currentCount + 1)
}

class BlobReferenceCounter {
  constructor() {
    this.blobHashesByProjectId = new Map()
  }

  processHistory(history, projectId) {
    let blobHashes = this.blobHashesByProjectId.get(projectId)
    if (blobHashes == null) {
      blobHashes = new Set()
      this.blobHashesByProjectId.set(projectId, blobHashes)
    }
    history.findBlobHashes(blobHashes)
  }

  getCounts() {
    const countsByHash = new Map()
    for (const blobHashes of this.blobHashesByProjectId.values()) {
      for (const hash of blobHashes) {
        incrementMapEntry(countsByHash, hash)
      }
    }
    return countsByHash
  }
}

class TextOperationCounter {
  constructor() {
    this.countsByProjectId = new Map()
  }

  processHistory(history, projectId) {
    for (const change of history.getChanges()) {
      let textOperationCount = 0
      for (const operation of change.getOperations()) {
        if (operation instanceof EditFileOperation) {
          textOperationCount++
        }
      }
      if (textOperationCount >= TEXT_OPERATION_COUNT_THRESHOLD) {
        this.countsByProjectId.set(
          projectId,
          Math.max(
            this.countsByProjectId.get(projectId) || 0,
            textOperationCount
          )
        )
      }
    }
  }

  getCounts() {
    return this.countsByProjectId
  }
}

main()
  .then(() => {
    process.exit()
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

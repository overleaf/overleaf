const commandLineArgs = require('command-line-args')
const BPromise = require('bluebird')
const timersPromises = require('node:timers/promises')

const { knex, historyStore } = require('..')

const MAX_POSTGRES_INTEGER = 2147483647
const DEFAULT_BATCH_SIZE = 1000
const DEFAULT_CONCURRENCY = 1
const MAX_RETRIES = 10
const RETRY_DELAY_MS = 5000

async function main() {
  const options = parseOptions()
  let batchStart = options.minId
  while (batchStart <= options.maxId) {
    const chunks = await getChunks(batchStart, options.maxId, options.batchSize)
    if (chunks.length === 0) {
      // No results. We're done.
      break
    }
    const batchEnd = chunks[chunks.length - 1].id
    await processBatch(chunks, options)
    console.log(`Processed chunks ${batchStart} to ${batchEnd}`)
    batchStart = batchEnd + 1
  }
}

function parseOptions() {
  const args = commandLineArgs([
    { name: 'min-id', type: Number, defaultValue: 1 },
    {
      name: 'max-id',
      type: Number,
      defaultValue: MAX_POSTGRES_INTEGER,
    },
    { name: 'batch-size', type: Number, defaultValue: DEFAULT_BATCH_SIZE },
    { name: 'concurrency', type: Number, defaultValue: DEFAULT_CONCURRENCY },
  ])
  return {
    minId: args['min-id'],
    maxId: args['max-id'],
    batchSize: args['batch-size'],
    concurrency: args.concurrency,
  }
}

async function getChunks(minId, maxId, batchSize) {
  const chunks = await knex('chunks')
    .where('id', '>=', minId)
    .andWhere('id', '<=', maxId)
    .orderBy('id')
    .limit(batchSize)
  return chunks
}

async function processBatch(chunks, options) {
  let retries = 0
  while (true) {
    const results = await BPromise.map(chunks, processChunk, {
      concurrency: options.concurrency,
    })
    const failedChunks = results
      .filter(result => !result.success)
      .map(result => result.chunk)
    if (failedChunks.length === 0) {
      // All chunks processed. Carry on.
      break
    }

    // Some projects failed. Retry.
    retries += 1
    if (retries > MAX_RETRIES) {
      console.log('Too many retries processing chunks. Giving up.')
      process.exit(1)
    }
    console.log(
      `Retrying chunks: ${failedChunks.map(chunk => chunk.id).join(', ')}`
    )
    await timersPromises.setTimeout(RETRY_DELAY_MS)
    chunks = failedChunks
  }
}

async function processChunk(chunk) {
  try {
    const rawHistory = await historyStore.loadRaw(
      chunk.doc_id.toString(),
      chunk.id
    )
    const startVersion = chunk.end_version - rawHistory.changes.length
    await knex('chunks')
      .where('id', chunk.id)
      .update({ start_version: startVersion })
    return { chunk, success: true }
  } catch (err) {
    console.error(`Failed to process chunk ${chunk.id}:`, err.stack)
    return { chunk, success: false }
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

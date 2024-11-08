/**
 * Compress changes for projects that have too many text operations.
 *
 * Usage:
 *
 *   node tasks/compress_changes.js CSV_FILE
 *
 * where CSV_FILE contains a list of project ids in the first column
 */

const fs = require('node:fs')
const BPromise = require('bluebird')
const { History } = require('overleaf-editor-core')
const { historyStore, chunkStore } = require('..')

const CONCURRENCY = 10

async function main() {
  const filename = process.argv[2]
  const projectIds = await readCsv(filename)
  const chunks = []
  for (const projectId of projectIds) {
    const chunkIds = await chunkStore.getProjectChunkIds(projectId)
    chunks.push(...chunkIds.map(id => ({ id, projectId })))
  }
  let totalCompressed = 0
  await BPromise.map(
    chunks,
    async chunk => {
      try {
        const history = await getHistory(chunk)
        const numCompressed = compressChanges(history)
        if (numCompressed > 0) {
          await storeHistory(chunk, history)
          console.log(
            `Compressed project ${chunk.projectId}, chunk ${chunk.id}`
          )
        }
        totalCompressed += numCompressed
      } catch (err) {
        console.log(err)
      }
    },
    { concurrency: CONCURRENCY }
  )
  console.log('CHANGES:', totalCompressed)
}

async function readCsv(filename) {
  const csv = await fs.promises.readFile(filename, 'utf-8')
  const lines = csv.trim().split('\n')
  const projectIds = lines.map(line => line.split(',')[0])
  return projectIds
}

async function getHistory(chunk) {
  const rawHistory = await historyStore.loadRaw(chunk.projectId, chunk.id)
  const history = History.fromRaw(rawHistory)
  return history
}

async function storeHistory(chunk, history) {
  const rawHistory = history.toRaw()
  await historyStore.storeRaw(chunk.projectId, chunk.id, rawHistory)
}

function compressChanges(history) {
  let numCompressed = 0
  for (const change of history.getChanges()) {
    const newOperations = compressOperations(change.operations)
    if (newOperations.length !== change.operations.length) {
      numCompressed++
    }
    change.setOperations(newOperations)
  }
  return numCompressed
}

function compressOperations(operations) {
  if (!operations.length) return []

  const newOperations = []
  let currentOperation = operations[0]
  for (let operationId = 1; operationId < operations.length; operationId++) {
    const nextOperation = operations[operationId]
    if (currentOperation.canBeComposedWith(nextOperation)) {
      currentOperation = currentOperation.compose(nextOperation)
    } else {
      // currentOperation and nextOperation cannot be composed. Push the
      // currentOperation and start over with nextOperation.
      newOperations.push(currentOperation)
      currentOperation = nextOperation
    }
  }
  newOperations.push(currentOperation)

  return newOperations
}

main()
  .then(() => {
    process.exit()
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

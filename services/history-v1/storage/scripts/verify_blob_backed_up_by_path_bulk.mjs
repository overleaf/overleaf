import fs from 'node:fs'
import { makeProjectKey } from '../lib/blob_store/index.js'
import { backupPersistor, projectBlobsBucket } from '../lib/backupPersistor.mjs'
import { NotFoundError } from '@overleaf/object-persistor/src/Errors.js'
import commandLineArgs from 'command-line-args'
import OError from '@overleaf/o-error'
import assert from '../lib/assert.js'
import { client, projects } from '../lib/mongodb.js'
import { ObjectId } from 'mongodb'
import { setTimeout } from 'node:timers/promises'

const { input, verbose } = commandLineArgs([
  { name: 'input', type: String },
  { name: 'verbose', type: Boolean, defaultValue: false },
])

function parseCSVRow(row) {
  const [path] = row.split(',')
  const pathSegments = path.split('/')
  const historyId = `${pathSegments[0]}${pathSegments[1]}${pathSegments[2]}`
    .split('')
    .reverse()
    .join('')

  return { historyId, path, hash: `${pathSegments[3]}${pathSegments[4]}` }
}

async function* readCSV(path) {
  let fh
  try {
    fh = await fs.promises.open(path, 'r')
  } catch (error) {
    console.error(`Could not open file: ${error}`)
    throw error
  }
  for await (const line of fh.readLines()) {
    try {
      const row = parseCSVRow(line)
      yield row
    } catch (error) {
      console.error(error instanceof Error ? error.message : error)
      console.log(`Skipping invalid row: ${line}`)
    }
  }
}

class MissingDEKError extends OError {}
class InvalidHistoryIdError extends OError {}
class MissingProjectError extends OError {}
class MissingBlobError extends OError {}

async function getProjectPersistor(historyId) {
  try {
    return await backupPersistor.forProjectRO(
      projectBlobsBucket,
      makeProjectKey(historyId, '')
    )
  } catch (err) {
    if (err instanceof NotFoundError) {
      throw new MissingDEKError('dek does not exist', { historyId }, err)
    }
    throw err
  }
}

async function checkBlobExists(path, historyId) {
  const persistor = await getProjectPersistor(historyId)
  return await persistor.getObjectSize(projectBlobsBucket, path)
}

let total = 0
const errors = {
  invalidProjectId: 0,
  notBackedUpProjectId: 0,
  missingBlob: 0,
  notInMongo: 0,
  unknown: 0,
}

const notInMongoProjectIds = new Set()
const notBackedUpProjectIds = new Set()

let stopping = false

process.on('SIGTERM', () => {
  console.log('SIGTERM received')
  stopping = true
})

process.on('SIGINT', () => {
  console.log('SIGINT received')
  stopping = true
})

/**
 *
 * @param {string} historyId
 * @param {string} path
 * @param {string} hash
 * @return {Promise<void>}
 */
async function checkPath(historyId, path, hash) {
  try {
    assert.mongoId(historyId)
  } catch (error) {
    throw InvalidHistoryIdError('invalid history id', { historyId })
  }
  if (notInMongoProjectIds.has(historyId)) {
    throw new MissingProjectError('project not in mongo', { historyId })
  }
  if (notBackedUpProjectIds.has(historyId)) {
    throw new MissingDEKError('project not backed up', { historyId })
  }

  const project = await projects.findOne({ _id: new ObjectId(historyId) })
  if (!project) {
    notInMongoProjectIds.add(historyId)
    throw new MissingProjectError('project not in mongo', { historyId })
  }
  try {
    await checkBlobExists(path, historyId)
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new MissingBlobError('missing blob', { historyId, hash })
    }
    if (error instanceof MissingDEKError) {
      notBackedUpProjectIds.add(historyId)
    }
    throw error
  }
}

for await (const line of readCSV(input)) {
  if (stopping) break
  total++
  if (total % 10_000 === 0) {
    console.log(`checked ${total}`)
  }
  const { historyId, path, hash } = line
  try {
    await checkPath(historyId, path, hash)
    if (verbose) {
      console.log(`✓ Project ${historyId} has ${hash} backed up`)
    }
  } catch (error) {
    if (error instanceof InvalidHistoryIdError) {
      errors.invalidProjectId++
      console.warn(`invalid historyId ${historyId}`)
      continue
    } else if (error instanceof MissingProjectError) {
      errors.notInMongo++
      console.warn(`✗ project ${historyId} not in mongo`)
      continue
    } else if (error instanceof MissingDEKError) {
      errors.notBackedUpProjectId++
      console.error(`✗ Project DEK ${historyId} not found`)
      continue
    } else if (error instanceof MissingBlobError) {
      errors.missingBlob++
      console.error(`✗ missing blob ${hash} from project ${historyId}`)
      continue
    }
    errors.unknown++
    console.error(error)
  }
}

console.log(`total checked: ${total}`)
console.log(`invalid project id: ${errors.invalidProjectId}`)
console.log(`not found in mongo: ${errors.notInMongo}`)
console.log(`missing blob: ${errors.missingBlob}`)
console.log(`project not backed up: ${errors.notBackedUpProjectId}`)
console.log(`unknown errors: ${errors.unknown}`)

await client.close()
await setTimeout(100)
process.exit()

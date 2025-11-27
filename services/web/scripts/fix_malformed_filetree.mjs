/**
 * This script fixes problems found by the find_malformed_filetrees.js script.
 *
 * The script takes a single argument --logs pointing at the output of a
 * previous run of the find_malformed_filetrees.js script.
 *
 * Alternatively, use an adhoc file: --logs=<(echo '{"projectId":"...","path":"..."}')
 */
import mongodb from 'mongodb-legacy'
import { db } from '../app/src/infrastructure/mongodb.mjs'
import ProjectLocator from '../app/src/Features/Project/ProjectLocator.mjs'
import minimist from 'minimist'
import readline from 'node:readline'
import fs from 'node:fs'
import logger from '@overleaf/logger'
import { scriptRunner } from './lib/ScriptRunner.mjs'

const { ObjectId } = mongodb
const { findDeep } = ProjectLocator
const lastUpdated = new Date()

const argv = minimist(process.argv.slice(2), {
  string: ['logs'],
})

let gracefulShutdownInitiated = false

process.on('SIGINT', handleSignal)
process.on('SIGTERM', handleSignal)

function handleSignal() {
  gracefulShutdownInitiated = true
  console.warn('graceful shutdown initiated, draining queue')
}

const STATS = {
  processedLines: 0,
  success: 0,
  alreadyProcessed: 0,
  hash: 0,
  failed: 0,
  unmatched: 0,
}
function logStats() {
  console.log(
    JSON.stringify({
      time: new Date(),
      gracefulShutdownInitiated,
      ...STATS,
    })
  )
}
setInterval(logStats, 10_000)

async function main() {
  const rl = readline.createInterface({
    input: fs.createReadStream(argv.logs),
  })
  for await (const line of rl) {
    if (gracefulShutdownInitiated) break
    STATS.processedLines++
    if (!line.startsWith('{')) continue
    try {
      const { projectId, path, _id } = JSON.parse(line)
      await processBadPath(projectId, path, _id)
    } catch (err) {
      STATS.failed++
      logger.err({ line, err }, 'failed to fix tree')
    }
  }
}

async function processBadPath(projectId, mongoPath, _id) {
  let modifiedCount
  if (isRootFolder(mongoPath)) {
    modifiedCount = await fixRootFolder(projectId)
  } else if (isArrayElement(mongoPath)) {
    modifiedCount = await removeNulls(projectId, _id)
  } else if (isArray(mongoPath)) {
    modifiedCount = await fixArray(projectId, mongoPath)
  } else if (isFolderId(mongoPath)) {
    modifiedCount = await fixFolderId(projectId, mongoPath)
  } else if (isDocOrFileId(mongoPath)) {
    modifiedCount = await removeElementsWithoutIds(
      projectId,
      parentPath(parentPath(mongoPath))
    )
  } else if (isName(mongoPath)) {
    modifiedCount = await fixName(projectId, _id)
  } else if (isHash(mongoPath)) {
    console.error(`Missing file hash: ${projectId}/${_id} (${mongoPath})`)
    console.error('SaaS: likely needs filestore restore')
    console.error('Server Pro: please reach out to support')
    STATS.hash++
    return
  } else {
    console.error(`Unexpected mongo path: ${mongoPath}`)
    STATS.unmatched++
    return
  }

  if (modifiedCount === 0) {
    STATS.alreadyProcessed++
  } else {
    STATS.success++
  }
}

function isRootFolder(path) {
  return path === 'rootFolder.0'
}

function isArray(path) {
  return /\.(docs|folders|fileRefs)$/.test(path)
}

function isArrayElement(path) {
  return /\.\d+$/.test(path)
}

function isFolderId(path) {
  return /\.folders\.\d+\._id$/.test(path)
}

function isDocOrFileId(path) {
  return /\.(docs|fileRefs)\.\d+\._id$/.test(path)
}

function isName(path) {
  return /\.name$/.test(path)
}

function isHash(path) {
  return /\.hash$/.test(path)
}

function parentPath(path) {
  return path.slice(0, path.lastIndexOf('.'))
}

/**
 * If the root folder structure is missing, set it up
 */
async function fixRootFolder(projectId) {
  const result = await db.projects.updateOne(
    {
      _id: new ObjectId(projectId),
      rootFolder: { $size: 0 },
    },
    {
      $set: {
        rootFolder: [
          {
            _id: new ObjectId(),
            name: 'rootFolder',
            folders: [],
            docs: [],
            fileRefs: [],
          },
        ],
        lastUpdated,
        lastUpdatedBy: null, // unset lastUpdatedBy
      },
    }
  )
  return result.modifiedCount
}

/**
 * Remove all nulls from the given docs/files/folders array
 */
async function removeNulls(projectId, _id) {
  if (!_id) {
    throw new Error('missing _id')
  }
  const project = await db.projects.findOne(
    { _id: new ObjectId(projectId) },
    { projection: { rootFolder: 1 } }
  )
  const foundResult = findDeep(project, obj => obj?._id?.toString() === _id)
  if (!foundResult) return
  const { path } = foundResult
  const result = await db.projects.updateOne(
    { _id: new ObjectId(projectId) },
    {
      $pull: {
        [`${path}.folders`]: null,
        [`${path}.docs`]: null,
        [`${path}.fileRefs`]: null,
      },
      $set: {
        lastUpdated,
        lastUpdatedBy: null, // unset lastUpdatedBy
      },
    }
  )
  return result.modifiedCount
}

/**
 * If the element at the given path is not an array, set it to an empty array
 */
async function fixArray(projectId, path) {
  const result = await db.projects.updateOne(
    { _id: new ObjectId(projectId), [path]: { $not: { $type: 'array' } } },
    { $set: { [path]: [], lastUpdated, lastUpdatedBy: null } }
  )
  return result.modifiedCount
}

/**
 * Generate a missing id for a folder
 */
async function fixFolderId(projectId, path) {
  const result = await db.projects.updateOne(
    { _id: new ObjectId(projectId), [path]: { $exists: false } },
    {
      $set: {
        [path]: new ObjectId(),
        lastUpdated,
        lastUpdatedBy: null, // unset lastUpdatedBy
      },
    }
  )
  return result.modifiedCount
}

/**
 * Remove elements that don't have ids in the array at the given path
 */
async function removeElementsWithoutIds(projectId, path) {
  const result = await db.projects.updateOne(
    { _id: new ObjectId(projectId), [path]: { $type: 'array' } },
    {
      $pull: { [path]: { _id: null } },
      $set: {
        lastUpdated,
        lastUpdatedBy: null, // unset lastUpdatedBy
      },
    }
  )
  return result.modifiedCount
}

/**
 * Give a name to a file/doc/folder that doesn't have one
 */
async function fixName(projectId, _id) {
  if (!_id) {
    throw new Error('missing _id')
  }
  const project = await db.projects.findOne(
    { _id: new ObjectId(projectId) },
    { projection: { rootFolder: 1 } }
  )
  const foundResult = findDeep(project, obj => obj?._id?.toString() === _id)
  if (!foundResult) return
  const { path } = foundResult
  const array = ProjectLocator.findElementByMongoPath(project, parentPath(path))
  const name =
    path === 'rootFolder.0'
      ? 'rootFolder'
      : findUniqueName(new Set(array.map(x => x?.name)))
  const pathToName = `${path}.name`
  const result = await db.projects.updateOne(
    { _id: new ObjectId(projectId), [pathToName]: { $in: [null, ''] } },
    {
      $set: {
        [pathToName]: name,
        lastUpdated,
        lastUpdatedBy: null, // unset lastUpdatedBy
      },
    }
  )
  return result.modifiedCount
}

function findUniqueName(existingFilenames) {
  let index = 0
  let filename = 'untitled'
  while (existingFilenames.has(filename)) {
    index += 1
    filename = `untitled-${index}`
  }
  return filename
}

try {
  try {
    await scriptRunner(main)
  } finally {
    logStats()
  }
  if (STATS.failed > 0) {
    process.exit(Math.min(STATS.failed, 99))
  } else if (STATS.hash > 0) {
    process.exit(100)
  } else if (STATS.unmatched > 0) {
    process.exit(101)
  } else {
    process.exit(0)
  }
} catch (error) {
  console.error(error)
  process.exit(1)
}

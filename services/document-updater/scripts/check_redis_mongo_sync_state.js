const fs = require('fs')
const Path = require('path')
const _ = require('lodash')
const logger = require('@overleaf/logger')
const OError = require('@overleaf/o-error')
const LockManager = require('../app/js/LockManager')
const PersistenceManager = require('../app/js/PersistenceManager')
const ProjectFlusher = require('../app/js/ProjectFlusher')
const ProjectManager = require('../app/js/ProjectManager')
const RedisManager = require('../app/js/RedisManager')
const Settings = require('@overleaf/settings')

const AUTO_FIX_VERSION_MISMATCH =
  process.env.AUTO_FIX_VERSION_MISMATCH === 'true'
const SCRIPT_LOG_LEVEL = process.env.SCRIPT_LOG_LEVEL || 'warn'
const FLUSH_IN_SYNC_PROJECTS = process.env.FLUSH_IN_SYNC_PROJECTS === 'true'
const FOLDER =
  process.env.FOLDER || '/tmp/overleaf-check-redis-mongo-sync-state'
const LIMIT = parseInt(process.env.LIMIT || '1000', 10)
const RETRIES = parseInt(process.env.RETRIES || '5', 10)
const WRITE_CONTENT = process.env.WRITE_CONTENT === 'true'

process.env.LOG_LEVEL = SCRIPT_LOG_LEVEL
logger.initialize('check-redis-mongo-sync-state')

const COMPARE_AND_SET =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("set", KEYS[1], ARGV[2]) else return 0 end'

/**
 * @typedef {Object} Doc
 * @property {number} version
 * @property {Array<string>} lines
 * @property {string} pathname
 * @property {Object} ranges
 */

class TryAgainError extends Error {}

/**
 * @param {string} docId
 * @param {Doc} redisDoc
 * @param {Doc} mongoDoc
 * @return {Promise<void>}
 */
async function updateDocVersionInRedis(docId, redisDoc, mongoDoc) {
  const lockValue = await LockManager.promises.getLock(docId)
  try {
    const key = Settings.redis.documentupdater.key_schema.docVersion({
      doc_id: docId,
    })
    const numberOfKeys = 1
    const ok = await RedisManager.rclient.eval(
      COMPARE_AND_SET,
      numberOfKeys,
      key,
      redisDoc.version,
      mongoDoc.version
    )
    if (!ok) {
      throw new TryAgainError(
        'document has been updated, aborting overwrite. Try again.'
      )
    }
  } finally {
    await LockManager.promises.releaseLock(docId, lockValue)
  }
}

/**
 * @param {string} projectId
 * @param {string} docId
 * @return {Promise<boolean>}
 */
async function processDoc(projectId, docId) {
  const redisDoc = /** @type Doc */ await RedisManager.promises.getDoc(
    projectId,
    docId
  )
  const mongoDoc = /** @type Doc */ await PersistenceManager.promises.getDoc(
    projectId,
    docId
  )

  if (mongoDoc.version < redisDoc.version) {
    // mongo is behind, we can flush to mongo when all docs are processed.
    return false
  }

  mongoDoc.snapshot = mongoDoc.lines.join('\n')
  redisDoc.snapshot = redisDoc.lines.join('\n')
  if (!mongoDoc.ranges) mongoDoc.ranges = {}
  if (!redisDoc.ranges) redisDoc.ranges = {}

  const sameLines = mongoDoc.snapshot === redisDoc.snapshot
  const sameRanges = _.isEqual(mongoDoc.ranges, redisDoc.ranges)
  if (sameLines && sameRanges) {
    if (mongoDoc.version > redisDoc.version) {
      // mongo is ahead, technically out of sync, but practically the content is identical
      if (AUTO_FIX_VERSION_MISMATCH) {
        console.log(
          `Fixing out of sync doc version for doc ${docId} in project ${projectId}: mongo=${mongoDoc.version} > redis=${redisDoc.version}`
        )
        await updateDocVersionInRedis(docId, redisDoc, mongoDoc)
        return false
      } else {
        console.error(
          `Detected out of sync redis and mongo version for doc ${docId} in project ${projectId}, auto-fixable via AUTO_FIX_VERSION_MISMATCH=true`
        )
        return true
      }
    } else {
      // same lines, same ranges, same version
      return false
    }
  }

  const dir = Path.join(FOLDER, projectId, docId)
  console.error(
    `Detected out of sync redis and mongo content for doc ${docId} in project ${projectId}`
  )
  if (!WRITE_CONTENT) return true

  console.log(`pathname: ${mongoDoc.pathname}`)
  console.log(`mongo version: ${mongoDoc.version}`)
  console.log(`redis version: ${redisDoc.version}`)

  await fs.promises.mkdir(dir, { recursive: true })

  if (sameLines) {
    console.log('mongo lines match redis lines')
  } else {
    console.log(
      `mongo lines and redis lines out of sync, writing content into ${dir}`
    )
    await fs.promises.writeFile(
      Path.join(dir, 'mongo-snapshot.txt'),
      mongoDoc.snapshot
    )
    await fs.promises.writeFile(
      Path.join(dir, 'redis-snapshot.txt'),
      redisDoc.snapshot
    )
  }
  if (sameRanges) {
    console.log('mongo ranges match redis ranges')
  } else {
    console.log(
      `mongo ranges and redis ranges out of sync, writing content into ${dir}`
    )
    await fs.promises.writeFile(
      Path.join(dir, 'mongo-ranges.json'),
      JSON.stringify(mongoDoc.ranges)
    )
    await fs.promises.writeFile(
      Path.join(dir, 'redis-ranges.json'),
      JSON.stringify(redisDoc.ranges)
    )
  }
  console.log('---')
  return true
}

/**
 * @param {string} projectId
 * @return {Promise<number>}
 */
async function processProject(projectId) {
  const docIds = await RedisManager.promises.getDocIdsInProject(projectId)

  let outOfSync = 0
  for (const docId of docIds) {
    let lastErr
    for (let i = 0; i <= RETRIES; i++) {
      try {
        if (await processDoc(projectId, docId)) {
          outOfSync++
        }
        break
      } catch (err) {
        lastErr = err
      }
    }
    if (lastErr) {
      throw OError.tag(lastErr, 'process doc', { docId })
    }
  }
  if (outOfSync === 0 && FLUSH_IN_SYNC_PROJECTS) {
    try {
      await ProjectManager.promises.flushAndDeleteProjectWithLocks(
        projectId,
        {}
      )
    } catch (err) {
      throw OError.tag(err, 'flush project with only in-sync docs')
    }
  }
  return outOfSync
}

/**
 * @param {Set<string>} processed
 * @param {Set<string>} outOfSync
 * @return {Promise<{perIterationOutOfSync: number, done: boolean}>}
 */
async function scanOnce(processed, outOfSync) {
  const projectIds = await ProjectFlusher.promises.flushAllProjects({
    limit: LIMIT,
    dryRun: true,
  })

  let perIterationOutOfSync = 0
  for (const projectId of projectIds) {
    if (processed.has(projectId)) continue
    processed.add(projectId)

    let perProjectOutOfSync = 0
    try {
      perProjectOutOfSync = await processProject(projectId)
    } catch (err) {
      throw OError.tag(err, 'process project', { projectId })
    }
    perIterationOutOfSync += perProjectOutOfSync
    if (perProjectOutOfSync > 0) {
      outOfSync.add(projectId)
    }
  }

  return { perIterationOutOfSync, done: projectIds.length < LIMIT }
}

/**
 * @return {Promise<number>}
 */
async function main() {
  if (!WRITE_CONTENT) {
    console.warn()
    console.warn(
      `  Use WRITE_CONTENT=true to write the content of out of sync docs to FOLDER=${FOLDER}`
    )
    console.warn()
  } else {
    console.log(
      `Writing content for projects with out of sync docs into FOLDER=${FOLDER}`
    )
    await fs.promises.mkdir(FOLDER, { recursive: true })
    const existing = await fs.promises.readdir(FOLDER)
    if (existing.length > 0) {
      console.warn()
      console.warn(
        `  Found existing entries in FOLDER=${FOLDER}. Please delete or move these before running the script again.`
      )
      console.warn()
      return 101
    }
  }
  if (LIMIT < 100) {
    console.warn()
    console.warn(
      `  Using small LIMIT=${LIMIT}, this can take a while to SCAN in a large redis database.`
    )
    console.warn()
  }

  const processed = new Set()
  const outOfSyncProjects = new Set()
  let totalOutOfSyncDocs = 0
  while (true) {
    const before = processed.size
    const { perIterationOutOfSync, done } = await scanOnce(
      processed,
      outOfSyncProjects
    )
    totalOutOfSyncDocs += perIterationOutOfSync
    console.log(`Processed ${processed.size} projects`)
    console.log(
      `Found ${
        outOfSyncProjects.size
      } projects with ${totalOutOfSyncDocs} out of sync docs: ${JSON.stringify(
        Array.from(outOfSyncProjects)
      )}`
    )
    if (done) {
      console.log('Finished iterating all projects in redis')
      break
    }
    if (processed.size === before) {
      console.error(
        `Found too many un-flushed projects (LIMIT=${LIMIT}). Please fix the reported projects first, then try again.`
      )
      if (!FLUSH_IN_SYNC_PROJECTS) {
        console.error(
          'Use FLUSH_IN_SYNC_PROJECTS=true to flush projects that have been checked.'
        )
      }
      return 2
    }
  }
  return totalOutOfSyncDocs > 0 ? 1 : 0
}

main()
  .then(code => {
    process.exit(code)
  })
  .catch(error => {
    console.error(OError.getFullStack(error))
    console.error(OError.getFullInfo(error))
    process.exit(1)
  })

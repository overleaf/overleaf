const fsPromises = require('node:fs/promises')
const { ObjectId } = require('mongodb')
const BPromise = require('bluebird')
const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')
const rclient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.documentupdater
)
const mongodb = require('../lib/mongodb')
const { chunkStore } = require('..')
const Events = require('node:events')

// Silence warning.
Events.setMaxListeners(20)

const BATCH_SIZE = 1000
const OPTIONS = {
  concurrency: parseInt(process.env.DOC_VERSION_RECOVERY_CONCURRENCY, 10) || 20,
  force: process.env.DOC_VERSION_RECOVERY_FORCE === 'true',
  'skip-history-failures':
    process.env.DOC_VERSION_RECOVERY_SKIP_HISTORY_FAILURES === 'true',
  'resyncs-needed-file': process.env.DOC_VERSION_RECOVERY_RESYNCS_NEEDED_FILE,
}

const db = {
  deletedProjects: mongodb.db.collection('deletedProjects'),
  docs: mongodb.db.collection('docs'),
  migrations: mongodb.db.collection('migrations'),
  projects: mongodb.db.collection('projects'),
}

const BAD_MIGRATION_NAME =
  '20231219081700_move_doc_versions_from_docops_to_docs'

const RECOVERY_FILES_502 = [
  '/var/lib/overleaf/data/history/doc-version-recovery-resyncs.log',
  '/var/lib/overleaf/data/history/doc-version-recovery-resyncs.log.done',
]

let loggingChain = Promise.resolve()
const projectIdsThatNeedResyncing = []
const unflushedDocIds = new Set()

async function flushLogQueue() {
  const logPath = OPTIONS['resyncs-needed-file']
  loggingChain = loggingChain.then(async () => {
    const batch = projectIdsThatNeedResyncing.splice(0)
    if (batch.length === 0) return
    try {
      await fsPromises.appendFile(logPath, batch.join('\n') + '\n')
    } catch (err) {
      projectIdsThatNeedResyncing.push(...batch)
      logger.err({ err, logPath, batch }, 'Failed to write to log file')
    }
  })
  await loggingChain
}
async function recordProjectNeedsResync(projectId) {
  if (OPTIONS['resyncs-needed-file']) {
    projectIdsThatNeedResyncing.push(projectId)
    await flushLogQueue()
  } else {
    console.log(`Project ${projectId} needs a hard resync.`)
  }
}

async function main() {
  const recovery502Ran = await did502RecoveryRun()
  await getUnflushedDocIds()
  const badMigration = await db.migrations.findOne({ name: BAD_MIGRATION_NAME })

  if (unflushedDocIds.size > 0 && !recovery502Ran && badMigration != null) {
    // Tell customers that they need to flush
    console.log(`
--------------------------------------------------------------------
Detected unflushed changes while recovering doc versions.
Please go back to version 5.0.1 and follow the recovery procedure
for flushing document updates:

https://github.com/overleaf/overleaf/wiki/Doc-version-recovery
--------------------------------------------------------------------`)
    process.exit(1)
  }

  if (OPTIONS.force || recovery502Ran || badMigration != null) {
    console.warn('Need to recover doc versions. This will take a while.')
    await runRecovery()
    await db.migrations.deleteOne({ name: BAD_MIGRATION_NAME })
    await delete502RecoveryFiles()
  }

  console.log('Done.')
}

async function did502RecoveryRun() {
  for (const file of RECOVERY_FILES_502) {
    try {
      await fsPromises.stat(file)
      return true
    } catch (err) {
      // file doesn't exist. continue
    }
  }
  return false
}

async function delete502RecoveryFiles() {
  for (const file of RECOVERY_FILES_502) {
    try {
      await fsPromises.rename(file, file.replace('.log', '-5.0.2.log'))
    } catch (err) {
      // file doesn't exist. continue
    }
  }
}

async function runRecovery() {
  let batch = []
  const summary = {
    ignored: 0,
    skipped: 0,
    deletedUpdatedMongo: 0,
    deletedUpdatedRedis: 0,
    deletedUpdatedBoth: 0,
    deletedIgnored: 0,
    updatedMongo: 0,
    updatedRedis: 0,
    updatedBoth: 0,
  }
  const processBatchAndLogProgress = async () => {
    try {
      await BPromise.map(batch, project => processProject(project, summary), {
        concurrency: OPTIONS.concurrency,
      })
    } finally {
      console.log(`${summary.updatedRedis} projects updated in Redis`)
      console.log(`${summary.updatedMongo} projects updated in Mongo`)
      console.log(
        `${summary.updatedBoth} projects updated in both Mongo and Redis`
      )
      console.log(`${summary.ignored} projects had good versions`)
      console.log(
        `${summary.deletedUpdatedMongo} deleted projects updated in Mongo`
      )
      console.log(
        `${summary.deletedUpdatedRedis} deleted projects updated in Redis`
      )
      console.log(
        `${summary.deletedUpdatedBoth} deleted projects updated in both Mongo and Redis`
      )
      console.log(
        `${summary.deletedIgnored} deleted projects had good versions`
      )
      console.log(`${summary.skipped} projects skipped`)
    }
    batch = []
  }

  await printDBStats()
  await initResyncsNeededFile()
  for await (const project of getProjects()) {
    batch.push(project)
    if (batch.length >= BATCH_SIZE) {
      await processBatchAndLogProgress()
    }
  }

  for await (const deletedProject of getDeletedProjects()) {
    const project = deletedProject.project
    project.isDeleted = true
    batch.push(project)
    if (batch.length >= BATCH_SIZE) {
      await processBatchAndLogProgress()
    }
  }

  if (batch.length > 0) {
    await processBatchAndLogProgress()
  }

  await backfillMissingVersions()
}

async function getUnflushedDocIds() {
  const batchSize = 1000
  let cursor = '0'
  do {
    const [newCursor, keys] = await rclient.scan(
      cursor,
      'MATCH',
      Settings.redis.documentupdater.key_schema.docVersion({ doc_id: '*' }),
      'COUNT',
      batchSize
    )
    for (const key of keys) {
      unflushedDocIds.add(key.slice('DocVersion:'.length))
    }
    cursor = newCursor
  } while (cursor !== '0')
}

async function printDBStats() {
  const projects = await db.projects.estimatedDocumentCount()
  const deletedProjects = await db.deletedProjects.countDocuments()
  const docs = await db.docs.estimatedDocumentCount()
  console.log(
    `Need to check ${projects} projects and up-to ${deletedProjects} deleted projects with a total of ${docs} docs.`
  )
}

async function initResyncsNeededFile() {
  const logPath = OPTIONS['resyncs-needed-file']
  if (logPath) {
    await fsPromises.writeFile(logPath, '')
    await fsPromises.rm(`${logPath}.done`, { force: true })
  }
}

function getProjects() {
  return db.projects.find({}, { projection: { _id: 1, overleaf: 1 } })
}

function getDeletedProjects() {
  return db.deletedProjects.find(
    { 'project.overleaf.history.id': { $exists: true } },
    { projection: { 'project._id': 1, 'project.overleaf': 1 } }
  )
}

async function processProject(project, summary) {
  const projectId = project._id.toString()
  let updatedMongo = false
  let updatedRedis = false
  try {
    const historyDocVersions = await getHistoryDocVersions(project)

    for (const { docId, version } of historyDocVersions) {
      const update = await fixDocVersion(docId, version)
      if (update != null) {
        if (update.in === 'mongo') {
          updatedMongo = true
        } else if (update.in === 'redis') {
          updatedRedis = true
        }
      }
    }

    if (project.isDeleted) {
      if (updatedMongo && updatedRedis) {
        summary.deletedUpdatedBoth += 1
      } else if (updatedMongo) {
        summary.deletedUpdatedMongo += 1
      } else if (updatedRedis) {
        summary.deletedUpdatedRedis += 1
      } else {
        summary.deletedIgnored += 1
      }
    } else {
      await recordProjectNeedsResync(projectId)
      if (updatedMongo && updatedRedis) {
        summary.updatedBoth += 1
      } else if (updatedMongo) {
        summary.updatedMongo += 1
      } else if (updatedRedis) {
        summary.updatedRedis += 1
      } else {
        summary.ignored += 1
      }
    }
  } catch (err) {
    logger.error({ err, projectId }, 'Failed to process project')
    if (OPTIONS['skip-history-failures']) {
      summary.skipped += 1
    } else {
      throw err
    }
  }
}

async function getHistoryDocVersions(project) {
  const historyId = project.overleaf.history.id
  const chunk = await chunkStore.loadLatest(historyId)
  if (chunk == null) {
    return []
  }

  const snapshot = chunk.getSnapshot()
  const changes = chunk.getChanges()
  snapshot.applyAll(changes)
  const v2DocVersions = snapshot.getV2DocVersions()
  if (v2DocVersions == null) {
    return []
  }
  return Object.entries(v2DocVersions.data).map(([docId, versionInfo]) => ({
    docId,
    version: versionInfo.v,
  }))
}

async function fixDocVersion(docId, historyVersion) {
  const redisVersion = await getRedisDocVersion(docId)
  if (redisVersion != null && historyVersion >= redisVersion) {
    await setRedisDocVersion(docId, historyVersion + 1)
    return {
      in: 'redis',
      previousVersion: redisVersion,
      newVersion: historyVersion + 1,
    }
  } else {
    const docBeforeUpdate = await db.docs.findOneAndUpdate(
      {
        _id: new ObjectId(docId),
        $or: [
          { version: { $lte: historyVersion } },
          { version: { $exists: false } },
        ],
      },
      { $set: { version: historyVersion + 1 } },
      { projection: { _id: 1, version: 1 } }
    )

    if (docBeforeUpdate != null) {
      return {
        in: 'mongo',
        previousVersion: docBeforeUpdate.version,
        newVersion: historyVersion + 1,
      }
    } else {
      return null
    }
  }
}

async function getRedisDocVersion(docId) {
  if (!unflushedDocIds.has(docId)) {
    return null
  }
  const result = await rclient.get(
    Settings.redis.documentupdater.key_schema.docVersion({ doc_id: docId })
  )
  if (result == null) {
    return null
  }
  return parseInt(result, 10)
}

async function setRedisDocVersion(docId, version) {
  const multi = rclient.multi()
  multi.set(
    Settings.redis.documentupdater.key_schema.docVersion({ doc_id: docId }),
    version
  )
  multi.set(`UnflushedTime:{${docId}}`, Date.now(), 'NX')
  await multi.exec()
}

/**
 * Set all remaining versions to 0
 */
async function backfillMissingVersions() {
  console.log('Defaulting version to 0 for remaining docs.')
  await db.docs.updateMany(
    { version: { $exists: false } },
    { $set: { version: 0 } }
  )
}

main()
  .finally(async () => {
    console.log('Flushing log queue.')
    await flushLogQueue()
  })
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

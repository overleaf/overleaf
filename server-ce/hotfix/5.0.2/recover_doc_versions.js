const fsPromises = require('fs/promises')
const { ObjectId } = require('mongodb')
const BPromise = require('bluebird')
const logger = require('@overleaf/logger')
const mongodb = require('../lib/mongodb')
const { chunkStore } = require('..')
const Events = require('events')

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

let loggingChain = Promise.resolve()
const projectIdsThatNeedResyncing = []

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
  const badMigration = await db.migrations.findOne({ name: BAD_MIGRATION_NAME })
  if (OPTIONS.force || badMigration != null) {
    console.warn('Need to recover doc versions. This will take a while.')
    await runRecovery()
  }
  await db.migrations.deleteOne({ name: BAD_MIGRATION_NAME })
  console.log('Done.')
}

async function runRecovery() {
  let batch = []
  const summary = {
    updated: 0,
    ignored: 0,
    skipped: 0,
    deletedUpdated: 0,
    deletedIgnored: 0,
  }
  const processBatchAndLogProgress = async () => {
    try {
      await BPromise.map(batch, project => processProject(project, summary), {
        concurrency: OPTIONS.concurrency,
      })
    } finally {
      console.log(`${summary.updated} projects updated`)
      console.log(`${summary.ignored} projects had good versions`)
      console.log(`${summary.deletedUpdated} deleted projects updated`)
      console.log(
        `${summary.deletedIgnored} deleted projects had good versions`
      )
      console.log(`${summary.skipped} projects skipped`)
    }
    batch = []
  }

  await printDBStats()
  await touchResyncsNeededFile()
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

async function printDBStats() {
  const projects = await db.projects.estimatedDocumentCount()
  const docs = await db.docs.estimatedDocumentCount()
  console.log(
    `Need to check ${projects} projects with a total of ${docs} docs.`
  )
}

async function touchResyncsNeededFile() {
  if (OPTIONS['resyncs-needed-file']) {
    await fsPromises.appendFile(OPTIONS['resyncs-needed-file'], '')
  }
}

function getProjects() {
  return db.projects.find({}, { projection: { _id: 1, overleaf: 1 } })
}

function getDeletedProjects() {
  return db.deletedProjects.find(
    { project: { $ne: null } },
    { projection: { 'project._id': 1, 'project.overleaf': 1 } }
  )
}

async function processProject(project, summary) {
  const projectId = project._id.toString()
  let updated = false
  try {
    const historyDocVersions = await getHistoryDocVersions(project)

    for (const { docId, version } of historyDocVersions) {
      const update = await fixMongoDocVersion(docId, version)
      if (update != null) {
        updated = true
      }
    }

    if (project.isDeleted) {
      if (updated) {
        summary.deletedUpdated += 1
      } else {
        summary.deletedIgnored += 1
      }
    } else {
      await recordProjectNeedsResync(projectId)
      if (updated) {
        summary.updated += 1
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

async function fixMongoDocVersion(docId, historyVersion) {
  const docBeforeUpdate = await db.docs.findOneAndUpdate(
    {
      _id: new ObjectId(docId),
      $or: [
        { version: { $lte: historyVersion } },
        { version: { $exists: false } },
      ],
    },
    { $set: { version: historyVersion + 1 } }
  )
  if (docBeforeUpdate != null) {
    return {
      previousVersion: docBeforeUpdate.version,
      newVersion: historyVersion + 1,
    }
  } else {
    return null
  }
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

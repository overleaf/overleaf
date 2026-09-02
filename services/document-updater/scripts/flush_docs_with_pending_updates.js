// Flush docs that were left with a stuck PendingUpdates queue in redis after
// their project was flushed (and possibly hard deleted since).
//
// For each doc with a PendingUpdates queue, the project id is looked up in
// db.docs, then the pending updates are processed and the doc is flushed and
// removed from redis. Docs whose project cannot be found (e.g. hard deleted
// projects) are logged and can be discarded with --discard-hard-deleted.

const minimist = require('minimist')
const Settings = require('@overleaf/settings')
const OError = require('@overleaf/o-error')
const DocumentManager = require('../app/js/DocumentManager')
const HistoryManager = require('../app/js/HistoryManager')
const ProjectFlusher = require('../app/js/ProjectFlusher')
const { rclient } = require('../app/js/RedisManager')
const { db, ObjectId, mongoClient } = require('../app/js/mongodb')

const keys = Settings.redis.documentupdater.key_schema

const summary = {
  totalDocs: 0,
  flushedDocs: 0,
  missingDocs: 0,
  discardedDocs: 0,
  erroredDocs: 0,
}

function printSummary() {
  console.log(
    `Processed ${summary.totalDocs} docs with pending updates: flushed=${summary.flushedDocs} missing=${summary.missingDocs} discarded=${summary.discardedDocs} errored=${summary.erroredDocs}`
  )
}

function usage() {
  console.error(`
Usage: node scripts/flush_docs_with_pending_updates.js [options]

Options:
  --estimated-docs        Required. Estimated number of documents in db.docs,
                          used as a safety check that the right database is
                          consulted for the doc lookups. The script aborts
                          unless the estimated collection count is within 20%
                          of this value.
  --log-unflushed         When the db.docs lookup failed for a doc, log its
                          pending updates and, if the doc has unflushed
                          changes, all its doc keys
                          (default: true, disable via --log-unflushed=false)
  --discard-hard-deleted  Discard the stuck queue and the other doc keys of
                          docs whose db.docs lookup failed (default: false)
  --docId                 Process a single doc instead of scanning redis
  --projectId             Override the project id for --docId, skipping the
                          db.docs lookup
  --dry-run               Only scan and log, without flushing, deleting or
                          discarding anything (default: false)
  --limit                 Maximum number of PendingUpdates keys to scan
                          (default: 100000)
  --help                  Show this help message
`)
}

async function getDocIds(options) {
  if (options.docId) {
    return [options.docId]
  }
  const docKeys = await ProjectFlusher._getKeys(
    keys.pendingUpdates({ doc_id: '*' }),
    options.limit
  )
  return ProjectFlusher._extractIds(docKeys)
}

async function processDoc(docId, options) {
  let projectId = options.projectId
  if (!projectId) {
    const doc = await db.docs.findOne(
      { _id: new ObjectId(docId) },
      { projection: { project_id: 1 } }
    )
    projectId = doc?.project_id?.toString()
  }

  if (projectId) {
    await flushDoc(projectId, docId, options)
  } else {
    await handleMissingDoc(docId, options)
  }
}

async function flushDoc(projectId, docId, options) {
  const queueLength = await rclient.llen(keys.pendingUpdates({ doc_id: docId }))
  if (options.dryRun) {
    console.log(
      `Would flush doc ${docId} in project ${projectId} with ${queueLength} pending updates`
    )
    return
  }
  console.log(
    `Flushing doc ${docId} in project ${projectId} with ${queueLength} pending updates`
  )
  await DocumentManager.promises.flushAndDeleteDocWithLock(projectId, docId, {})
  await HistoryManager.promises.flushProjectChanges(projectId, {})
  const remaining = await rclient.llen(keys.pendingUpdates({ doc_id: docId }))
  if (remaining > 0) {
    console.error(
      `Doc ${docId} in project ${projectId} still has ${remaining} pending updates after flushing`
    )
    summary.erroredDocs++
  } else {
    summary.flushedDocs++
  }
}

async function handleMissingDoc(docId, options) {
  summary.missingDocs++
  let message = `Doc ${docId} not found in db.docs`

  if (options.logUnflushed) {
    // Log the pending updates: they are the reason this doc is processed and
    // would be lost when discarding it. These can exist independently of any
    // unflushed doc content.
    const pendingUpdates = await rclient.lrange(
      keys.pendingUpdates({ doc_id: docId }),
      0,
      -1
    )
    message += `, pending updates: ${JSON.stringify(pendingUpdates)}`

    // In addition, log the unflushed doc content if there is any.
    const unflushedTime = await rclient.get(
      keys.unflushedTime({ doc_id: docId })
    )
    if (unflushedTime) {
      const doc = {
        unflushedTime,
        projectId: await rclient.get(keys.projectKey({ doc_id: docId })),
        lines: await rclient.get(keys.docLines({ doc_id: docId })),
        version: await rclient.get(keys.docVersion({ doc_id: docId })),
        hash: await rclient.get(keys.docHash({ doc_id: docId })),
        ranges: await rclient.get(keys.ranges({ doc_id: docId })),
        pathname: await rclient.get(keys.pathname({ doc_id: docId })),
        projectHistoryId: await rclient.get(
          keys.projectHistoryId({ doc_id: docId })
        ),
        lastUpdatedAt: await rclient.get(keys.lastUpdatedAt({ doc_id: docId })),
        lastUpdatedBy: await rclient.get(keys.lastUpdatedBy({ doc_id: docId })),
        resolvedCommentIds: await rclient.smembers(
          keys.resolvedCommentIds({ doc_id: docId })
        ),
      }
      message += `, unflushed doc keys: ${JSON.stringify(doc)}`
    }
  }
  console.warn(message)

  if (options.discardHardDeleted && !options.dryRun) {
    await discardDoc(docId)
    console.warn(`Discarded redis keys of doc ${docId}`)
    summary.discardedDocs++
  }
}

async function discardDoc(docId) {
  // Purge the project-level entries first: in case the script crashes mid-way,
  // a re-run can still resolve the project id from the ProjectId doc key.
  const projectId = await rclient.get(keys.projectKey({ doc_id: docId }))
  if (projectId) {
    await rclient.srem(keys.docsInProject({ project_id: projectId }), docId)
  }
  await rclient.srem(keys.historyRangesSupport(), docId)
  await rclient.del(
    keys.pendingUpdates({ doc_id: docId }),
    keys.docLines({ doc_id: docId }),
    keys.projectKey({ doc_id: docId }),
    keys.docVersion({ doc_id: docId }),
    keys.docHash({ doc_id: docId }),
    keys.ranges({ doc_id: docId }),
    keys.pathname({ doc_id: docId }),
    keys.projectHistoryId({ doc_id: docId }),
    keys.unflushedTime({ doc_id: docId }),
    keys.lastUpdatedBy({ doc_id: docId }),
    keys.lastUpdatedAt({ doc_id: docId }),
    keys.resolvedCommentIds({ doc_id: docId }),
    keys.docOps({ doc_id: docId })
  )
}

async function main() {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['log-unflushed', 'discard-hard-deleted', 'dry-run', 'help'],
    string: ['docId', 'projectId'],
    default: { limit: 100_000, 'log-unflushed': true },
  })

  if (argv.help) {
    usage()
    return 0
  }

  const options = {
    estimatedDocs: argv['estimated-docs'],
    logUnflushed: argv['log-unflushed'],
    discardHardDeleted: argv['discard-hard-deleted'],
    docId: argv.docId,
    projectId: argv.projectId,
    dryRun: argv['dry-run'],
    limit: argv.limit,
  }

  if (!Number.isInteger(options.estimatedDocs) || options.estimatedDocs <= 0) {
    console.error('--estimated-docs must be set to a positive integer')
    usage()
    return 1
  }
  if (options.docId && !ObjectId.isValid(options.docId)) {
    console.error('--docId is not a valid object id')
    usage()
    return 1
  }
  if (options.projectId && !options.docId) {
    console.error('--projectId can only be used together with --docId')
    usage()
    return 1
  }
  if (options.projectId && !ObjectId.isValid(options.projectId)) {
    console.error('--projectId is not a valid object id')
    usage()
    return 1
  }

  const actualDocs = await db.docs.estimatedDocumentCount()
  if (
    actualDocs < 0.8 * options.estimatedDocs ||
    actualDocs > 1.2 * options.estimatedDocs
  ) {
    console.error(
      `Aborting: the estimated db.docs count of ${actualDocs} is not within 20% of --estimated-docs=${options.estimatedDocs}, is this the right database?`
    )
    return 1
  }

  const docIds = await getDocIds(options)
  const limitReached = !options.docId && docIds.length >= options.limit
  for (const docId of docIds) {
    summary.totalDocs++
    try {
      await processDoc(docId, options)
    } catch (error) {
      console.error(`Error processing doc ${docId}`)
      console.error(OError.getFullStack(error))
      summary.erroredDocs++
    }
  }

  if (limitReached) {
    console.error(
      `Hit the scan limit of ${options.limit} keys; there may be more docs with pending updates. Re-run to process the rest.`
    )
    return 2
  }
  if (options.dryRun) {
    return summary.totalDocs > 0 ? 2 : 0
  }
  if (summary.erroredDocs > 0 || summary.missingDocs > summary.discardedDocs) {
    return 2
  }
  return 0
}

main()
  .then(code => {
    printSummary()
    rclient.quit()
    mongoClient.close()
    process.exit(code)
  })
  .catch(error => {
    printSummary()
    console.error(OError.getFullStack(error))
    console.error(OError.getFullInfo(error))
    process.exit(1)
  })

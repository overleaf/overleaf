const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const rclient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.documentupdater
)
const keys = Settings.redis.documentupdater.key_schema
const ProjectFlusher = require('../app/js/ProjectFlusher')
const RedisManager = require('../app/js/RedisManager')
const { mongoClient, db, ObjectId } = require('../app/js/mongodb')

const summary = { totalDocs: 0, deletedDocs: 0, skippedDocs: 0 }

async function removeDeletedDocs(dockeys, options) {
  const docIds = ProjectFlusher._extractIds(dockeys)
  for (const docId of docIds) {
    summary.totalDocs++
    const docCount = await db.docs.find({ _id: new ObjectId(docId) }).count()
    if (!docCount) {
      try {
        await removeDeletedDoc(docId, options)
      } catch (err) {
        logger.error({ docId, err }, 'error removing deleted doc')
      }
    }
  }
}

async function removeDeletedDoc(docId, options) {
  const projectId = await rclient.get(keys.projectKey({ doc_id: docId }))

  const {
    lines: docLines,
    version,
    ranges,
    pathname,
    projectHistoryId,
    unflushedTime,
    lastUpdatedAt,
    lastUpdatedBy,
    historyRangesSupport,
    resolvedCommentIds,
  } = await RedisManager.promises.getDoc(projectId, docId)

  const project = await db.projects.findOne({ _id: new ObjectId(projectId) })

  let status

  if (project) {
    const projectJSON = JSON.stringify(project.rootFolder)
    const containsDoc = projectJSON.indexOf(docId) !== -1
    if (containsDoc) {
      logger.warn(
        {
          projectId,
          docId,
          docLinesBytes: docLines && docLines.length,
          version,
          rangesBytes: ranges && ranges.length,
          pathname,
          projectHistoryId,
          unflushedTime,
          lastUpdatedAt,
          lastUpdatedBy,
          historyRangesSupport,
          resolvedCommentIds,
        },
        'refusing to delete doc, project contains docId'
      )
      summary.skippedDocs++
      return
    } else {
      logger.warn(
        {
          projectId,
          docId,
          docLinesBytes: docLines && docLines.length,
          version,
          rangesBytes: ranges && ranges.length,
          pathname,
          projectHistoryId,
          unflushedTime,
          lastUpdatedAt,
          lastUpdatedBy,
          historyRangesSupport,
          resolvedCommentIds,
        },
        'refusing to delete doc, project still exists'
      )
      summary.skippedDocs++
      return
    }
  } else {
    status = 'projectDeleted'
  }
  summary.deletedDocs++
  if (options.dryRun) {
    logger.info(
      {
        projectId,
        docId,
        docLinesBytes: docLines && docLines.length,
        version,
        rangesBytes: ranges && ranges.length,
        pathname,
        projectHistoryId,
        unflushedTime,
        lastUpdatedAt,
        lastUpdatedBy,
        historyRangesSupport,
        resolvedCommentIds,
        status,
        summary,
      },
      'dry run mode - would remove doc from redis'
    )
    return
  }
  logger.info(
    {
      projectId,
      docId,
      docLinesBytes: docLines && docLines.length,
      version,
      rangesBytes: ranges && ranges.length,
      pathname,
      projectHistoryId,
      unflushedTime,
      lastUpdatedAt,
      lastUpdatedBy,
      historyRangesSupport,
      resolvedCommentIds,
      status,
      summary,
    },
    'removing doc from redis'
  )
  await RedisManager.promises.removeDocFromMemory(projectId, docId)
}

async function findAndProcessDocs(options) {
  logger.info({ options }, 'removing deleted docs')
  let cursor = 0
  do {
    const [newCursor, doclinesKeys] = await rclient.scan(
      cursor,
      'MATCH',
      keys.docLines({ doc_id: '*' }),
      'COUNT',
      options.limit
    )
    await removeDeletedDocs(doclinesKeys, options)
    cursor = newCursor
  } while (cursor !== '0')
}

async function main() {
  const options = {
    limit: 1000,
    dryRun: process.env.DRY_RUN !== 'false',
  }
  if (process.argv.length > 2) {
    const docId = process.argv[process.argv.length - 1]
    if (!ObjectId.isValid(docId)) {
      throw new Error(
        'bad docId: usage: $ node scripts/remove_deleted_docs.js [DOC_ID]'
      )
    }
    await removeDeletedDoc(docId, options)
  } else {
    await findAndProcessDocs(options)
  }
}

main()
  .then(() => {
    rclient.quit()
    mongoClient.close()
    console.log('DONE')
    process.exit(0)
  })
  .catch(function (error) {
    console.error(error)
    process.exit(1)
  })

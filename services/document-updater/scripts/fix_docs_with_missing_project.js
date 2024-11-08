const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const rclient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.documentupdater
)
const keys = Settings.redis.documentupdater.key_schema
const ProjectFlusher = require('../app/js/ProjectFlusher')
const DocumentManager = require('../app/js/DocumentManager')
const { mongoClient, db, ObjectId } = require('../app/js/mongodb')
const util = require('node:util')
const flushAndDeleteDocWithLock = util.promisify(
  DocumentManager.flushAndDeleteDocWithLock
)

async function fixDocsWithMissingProjectIds(dockeys, options) {
  const docIds = ProjectFlusher._extractIds(dockeys)
  for (const docId of docIds) {
    const projectId = await rclient.get(keys.projectKey({ doc_id: docId }))
    logger.debug({ docId, projectId }, 'checking doc')
    if (!projectId) {
      try {
        await insertMissingProjectId(docId, options)
      } catch (err) {
        logger.error({ docId, err }, 'error fixing doc without project id')
      }
    }
  }
}

async function insertMissingProjectId(docId, options) {
  const doc = await db.docs.findOne({ _id: ObjectId(docId) })
  if (!doc) {
    logger.warn({ docId }, 'doc not found in mongo')
    return
  }
  if (!doc.project_id) {
    logger.error({ docId }, 'doc does not have project id in mongo')
    return
  }
  logger.debug({ docId, doc }, 'found doc')
  const projectIdFromMongo = doc.project_id.toString()
  if (options.dryRun) {
    logger.info(
      { projectIdFromMongo, docId },
      'dry run mode - would insert project id in redis'
    )
    return
  }
  // set the project id for this doc
  await rclient.set(keys.projectKey({ doc_id: docId }), projectIdFromMongo)
  logger.debug({ docId, projectIdFromMongo }, 'inserted project id in redis')
  if (projectIdFromMongo) {
    await flushAndDeleteDocWithLock(projectIdFromMongo, docId, {})
    logger.info(
      { docId, projectIdFromMongo },
      'fixed doc with empty project id'
    )
  }
  return projectIdFromMongo
}

async function findAndProcessDocs(options) {
  logger.info({ options }, 'fixing docs with missing projcct id')
  let cursor = 0
  do {
    const [newCursor, doclinesKeys] = await rclient.scan(
      cursor,
      'MATCH',
      keys.docLines({ doc_id: '*' }),
      'COUNT',
      options.limit
    )
    await fixDocsWithMissingProjectIds(doclinesKeys, options)
    cursor = newCursor
  } while (cursor !== '0')
}

findAndProcessDocs({ limit: 1000, dryRun: process.env.DRY_RUN !== 'false' })
  .then(result => {
    rclient.quit()
    mongoClient.close()
    console.log('DONE')
  })
  .catch(function (error) {
    console.error(error)
    process.exit(1)
  })

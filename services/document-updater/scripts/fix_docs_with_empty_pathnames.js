const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const rclient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.documentupdater
)
const keys = Settings.redis.documentupdater.key_schema
const ProjectFlusher = require('app/js/ProjectFlusher')
const DocumentManager = require('app/js/DocumentManager')
const util = require('node:util')
const flushAndDeleteDocWithLock = util.promisify(
  DocumentManager.flushAndDeleteDocWithLock
)

async function flushAndDeleteDocs(dockeys, options) {
  const docIds = ProjectFlusher._extractIds(dockeys)
  for (const docId of docIds) {
    const pathname = await rclient.get(keys.pathname({ doc_id: docId }))
    if (!pathname) {
      const projectId = await rclient.get(keys.projectKey({ doc_id: docId }))
      if (!projectId) {
        // await deleteDanglingDoc(projectId, docId, pathname, options)
        logger.info(
          { projectId, docId, pathname },
          'skipping doc with empty pathname and project id'
        )
      } else {
        await flushAndDeleteDoc(projectId, docId, pathname, options)
      }
    }
  }
}

async function flushAndDeleteDoc(projectId, docId, pathname, options) {
  if (options.dryRun) {
    logger.info(
      { projectId, docId, pathname },
      'dry run mode - would flush doc with empty pathname'
    )
    return
  }
  logger.info(
    { projectId, docId, pathname },
    'flushing doc with empty pathname'
  )
  try {
    await flushAndDeleteDocWithLock(projectId, docId, {})
  } catch (err) {
    logger.error(
      { projectId, docId, pathname, err },
      'error flushing and deleting doc without pathname'
    )
  }
}

async function cleanUpDocs(options) {
  logger.info({ options }, 'cleaning up docs without pathnames')
  let cursor = 0
  do {
    const [newCursor, doclinesKeys] = await rclient.scan(
      cursor,
      'MATCH',
      keys.docLines({ doc_id: '*' }),
      'COUNT',
      options.limit
    )
    await flushAndDeleteDocs(doclinesKeys, options)
    cursor = newCursor
  } while (cursor !== '0')
}

cleanUpDocs({ limit: 1000, dryRun: process.env.DRY_RUN !== 'false' })
  .then(result => {
    rclient.quit()
    console.log('DONE')
  })
  .catch(function (error) {
    console.error(error)
    process.exit(1)
  })

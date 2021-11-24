const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const rclient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.documentupdater
)
const keys = Settings.redis.documentupdater.key_schema
const ProjectFlusher = require('app/js/ProjectFlusher')
const DocumentManager = require('app/js/DocumentManager')
// const RedisManager = require('app/js/RedisManager')
const util = require('util')
const flushAndDeleteDocWithLock = util.promisify(
  DocumentManager.flushAndDeleteDocWithLock
)
// const getDoc = util.promisify((projectId, docId, cb) => {
//   RedisManager.getDoc(projectId, docId, (err, ...results) => {
//     cb(err, results)
//   })
// })

// const removeDocFromMemory = util.promisify(RedisManager.removeDocFromMemory)

async function flushAndDeleteDocs(dockeys, options) {
  logger.debug({ dockeys }, 'trying keys')
  const docIds = ProjectFlusher._extractIds(dockeys)
  for (const docId of docIds) {
    const pathname = await rclient.get(keys.pathname({ doc_id: docId }))
    logger.debug({ docId, pathname }, 'checking doc')
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

// async function deleteDanglingDoc(projectId, docId, pathname, options) {
//   const [
//     // eslint-disable-next-line no-unused-vars
//     _docLines,
//     version,
//     // eslint-disable-next-line no-unused-vars
//     _ranges,
//     // eslint-disable-next-line no-unused-vars
//     _pathname,
//     projectHistoryId,
//     unflushedTime,
//     lastUpdatedAt,
//     lastUpdatedBy,
//   ] = await getDoc(projectId, docId)
//   logger.warn(
//     {
//       projectId,
//       docId,
//       pathname,
//       version,
//       projectHistoryId,
//       unflushedTime,
//       lastUpdatedAt,
//       lastUpdatedBy,
//     },
//     'missing project id'
//   )
//   if (options.dryRun) {
//     logger.info(
//       { projectId, docId, pathname },
//       'dry run mode - would delete doc with empty pathname and project id'
//     )
//     return
//   }
//   logger.info(
//     { projectId, docId, pathname },
//     'deleting doc with empty pathname and project id'
//   )
//   try {
//     await removeDocFromMemory(projectId, docId)
//   } catch (err) {
//     logger.error(
//       { projectId, docId, pathname, err },
//       'error deleting doc with empty pathname and project id'
//     )
//   }
// }

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
    logger.debug({ count: doclinesKeys.length }, 'found docs')
    await flushAndDeleteDocs(doclinesKeys, options)
    cursor = newCursor
  } while (cursor !== '0')
}

cleanUpDocs({ limit: 1000, dryRun: true })
  .then(result => {
    console.log('DONE')
  })
  .catch(function (error) {
    if (error) {
      throw error
    }
    return process.exit()
  })

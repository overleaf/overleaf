// recover docs from redis where there is no doc in mongo but the project exists

import minimist from 'minimist'

import { db, ObjectId } from '../app/src/infrastructure/mongodb.mjs'
import ProjectEntityUpdateHandler from '../app/src/Features/Project/ProjectEntityUpdateHandler.mjs'
import ProjectEntityRestoreHandler from '../app/src/Features/Project/ProjectEntityRestoreHandler.mjs'
import RedisWrapper from '@overleaf/redis-wrapper'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import { scriptRunner } from './lib/ScriptRunner.mjs'
const opts = parseArgs()
const redis = RedisWrapper.createClient(Settings.redis.web)

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    boolean: ['commit'],
  })
  const commit = args.commit
  const deleteOversized = args['delete-oversized']
  return {
    commit,
    deleteOversized,
    maxDocSize: 2 * 1024 * 1024,
  }
}

function extractObjectId(s) {
  const m = s.match(/:\{?([0-9a-f]{24})\}?/)
  return m[1]
}

async function main() {
  logger.info({ opts }, 'removing deleted docs')
  let cursor = 0
  do {
    const [newCursor, doclinesKeys] = await redis.scan(
      cursor,
      'MATCH',
      'doclines:{*}',
      'COUNT',
      1000
    )
    const docIds = doclinesKeys.map(extractObjectId)
    for (const docId of docIds) {
      await processDoc(docId)
    }
    cursor = newCursor
  } while (cursor !== '0')
  if (!opts.commit) {
    console.log('This was a dry run. Re-run with --commit to apply changes')
  }
}

async function processDoc(docId) {
  // check if the doc is in mongo.. if so ignore it
  const docCount = await db.docs.find({ _id: new ObjectId(docId) }).count()
  if (docCount > 0) {
    logger.debug({ docId }, 'doc is present in mongo - no recovery needed')
    return
  }
  // get the doc from redis and check if it has a project id
  const doc = await getDoc(docId)
  const projectId = doc.projectId
  if (!projectId) {
    logger.warn(
      { docId, doc },
      'projectId not available in redis, cannot restore - skipping'
    )
    // we could delete the document in redis here since we have no way to recover it
    return
  }
  // check that the project is in mongo, if not delete the doc
  const project = await db.projects.findOne({ _id: new ObjectId(projectId) })
  if (!project) {
    logger.warn(
      { docId },
      'project not present in mongo - could remove doc from redis'
    )
    return
  }
  // if the doc is too big we will need to convert it to a file, skip it for now
  // or delete the doc if the --delete-oversized option is used
  const size = doc.lines.reduce((sum, line) => sum + line.length + 1, 0)
  if (size > opts.maxDocSize) {
    logger.warn(
      { docId, projectId, size },
      'doc that exceeds max size, cannot restore'
    )
    if (opts.deleteOversized) {
      logger.info(
        { docId, projectId, size, commit: opts.commit },
        'forcing delete of large doc'
      )
      if (opts.commit) {
        try {
          await deleteDocFromRedis(projectId, docId)
        } catch (err) {
          logger.error(
            { docId, projectId, deleteErr: err },
            'error deleting doc from redis'
          )
        }
      }
    }
    return
  }
  // now we have a doc content from redis, in a project where the doc has been deleted
  const restoredName = ProjectEntityRestoreHandler.generateRestoredName(
    doc.name || 'unknown',
    'recovered'
  )
  logger.info(
    { docId, projectId, restoredName, commit: opts.commit },
    'recovering doc from redis to mongo'
  )

  if (opts.commit) {
    const folderId = project.rootFolder[0]._id
    try {
      await ProjectEntityUpdateHandler.promises.addDocWithRanges(
        projectId,
        folderId,
        restoredName,
        doc.lines,
        doc.ranges,
        null,
        'recovery-script'
      )
      await deleteDocFromRedis(projectId, docId)
    } catch (err) {
      logger.error(
        { docId, projectId, restoreErr: err },
        'error restoring doc from redis to mongo'
      )
    }
  }
}

async function getDoc(docId) {
  const [projectId, lines, ranges, pathname] = await redis.mget(
    `ProjectId:{${docId}}`,
    `doclines:{${docId}}`,
    `Ranges:{${docId}}`,
    `Pathname:{${docId}}`
  )
  const name = pathname?.split('/').pop()
  return {
    projectId,
    id: docId,
    lines: JSON.parse(lines),
    ranges: ranges ? JSON.parse(ranges) : {},
    name: name || 'unnamed',
  }
}

async function deleteDocFromRedis(projectId, docId) {
  await redis.del(
    `Blocking:{${docId}}`,
    `doclines:{${docId}}`,
    `DocOps:{${docId}}`,
    `DocVersion:{${docId}}`,
    `DocHash:{${docId}}`,
    `ProjectId:{${docId}}`,
    `Ranges:{${docId}}`,
    `UnflushedTime:{${docId}}`,
    `Pathname:{${docId}}`,
    `ProjectHistoryId:{${docId}}`,
    `PendingUpdates:{${docId}}`,
    `lastUpdatedAt:{${docId}}`,
    `lastUpdatedBy:{${docId}}`
  )
  await redis.srem(`DocsIn:{${projectId}}`, projectId)
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}

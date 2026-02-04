// @ts-check

const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const RedisManager = require('../app/js/RedisManager')
const minimist = require('minimist')
const { db, ObjectId } = require('../app/js/mongodb')
const ProjectManager = require('../app/js/ProjectManager')
const OError = require('@overleaf/o-error')

const docUpdaterKeys = Settings.redis.documentupdater.key_schema

const rclient = RedisManager.rclient

const { verbose, commit, ...args } = minimist(process.argv.slice(2), {
  boolean: ['verbose', 'commit'],
  string: ['batchSize'],
  default: {
    batchSize: '1000',
  },
})

logger.logger.level(verbose ? 'debug' : 'warn')

const batchSize = parseInt(args.batchSize, 10)

/**
 * @typedef {import('ioredis').Redis} Redis
 */

/**
 *
 * @param {string} key
 * @return {string|void}
 */
function extractDocId(key) {
  const matches = key.match(/DocVersion:\{(.*?)\}/)
  if (matches) {
    return matches[1]
  }
}

/**
 *
 * @param {string} docId
 * @return {Promise<{projectId: string, historyId: string}>}
 */
async function getHistoryId(docId) {
  const doc = await db.docs.findOne(
    { _id: new ObjectId(docId) },
    { projection: { project_id: 1 }, readPreference: 'secondaryPreferred' }
  )

  if (!doc) {
    throw new OError('Doc not present in mongo', { docId })
  }

  const project = await db.projects.findOne(
    { _id: doc.project_id },
    {
      projection: { 'overleaf.history': 1 },
      readPreference: 'secondaryPreferred',
    }
  )

  if (!project?.overleaf?.history?.id) {
    throw new OError('Project not present in mongo (or has no history id)', {
      docId,
      project,
      doc,
    })
  }

  return {
    historyId: project?.overleaf?.history?.id,
    projectId: doc.project_id.toString(),
  }
}

/**
 * @typedef {Object} UpdateableDoc
 * @property {string} docId
 * @property {string} projectId
 * @property {string} historyId
 */

/**
 *
 * @param {Redis} node
 * @param {Array<string>} docIds
 * @return {Promise<Array<UpdateableDoc>>}
 */
async function findDocsWithMissingHistoryIds(node, docIds) {
  const fromRedis = await node.mget(
    docIds
      .map(docId => [
        docUpdaterKeys.docVersion({ doc_id: docId }),
        docUpdaterKeys.projectHistoryId({ doc_id: docId }),
      ])
      .flat()
  )

  const results = []

  for (const [index, docId] of docIds.entries()) {
    const docVersion = fromRedis[index * 2]
    const historyId = fromRedis[index * 2 + 1]
    if (!docVersion) {
      // Already removed from redis.
      continue
    }
    if (!historyId) {
      try {
        const { projectId, historyId } = await getHistoryId(docId)
        results.push({ projectId, historyId, docId, docVersion })
      } catch (error) {
        logger.warn(
          { error },
          'Error gathering data for doc with missing history id'
        )
      }
    }
  }
  return results
}

/**
 *
 * @param {Array<UpdateableDoc>} updates
 * @return {Promise<void>}
 */
async function fixAndFlushProjects(updates) {
  for (const update of updates) {
    if (commit) {
      try {
        await rclient.set(
          docUpdaterKeys.projectHistoryId({ doc_id: update.docId }),
          update.historyId
        )
        logger.debug({ ...update }, 'Set history id in redis')
        await ProjectManager.promises.flushAndDeleteProjectWithLocks(
          update.projectId,
          {}
        )
        logger.debug({ ...update }, 'Flushed project')
      } catch (err) {
        logger.error({ err, ...update }, 'Error fixing and flushing project')
      }
    } else {
      logger.debug(
        { ...update },
        'Would have set history id in redis and flushed'
      )
    }
  }
}

/**
 *
 * @param {Array<Redis>} nodes
 * @param {number} batchSize
 * @return {Promise<void>}
 */
async function scanNodes(nodes, batchSize = 1000) {
  let scanned = 0

  for (const node of nodes) {
    const stream = node.scanStream({
      match: docUpdaterKeys.docVersion({ doc_id: '*' }),
      count: batchSize,
    })

    for await (const docKeys of stream) {
      if (docKeys.length === 0) {
        continue
      }
      stream.pause()
      scanned += docKeys.length

      const docIds = docKeys
        .map((/** @type {string} */ docKey) => extractDocId(docKey))
        .filter(Boolean)

      try {
        const updates = await findDocsWithMissingHistoryIds(node, docIds)
        if (updates.length > 0) {
          logger.info({ updates }, 'Found doc(s) with missing history ids')
          await fixAndFlushProjects(updates)
        }
      } catch (error) {
        logger.error({ docKeys }, 'Error processing batch')
      } finally {
        stream.resume()
      }
    }

    logger.info({ scanned, server: node.serverInfo.role }, 'Scanned node')
  }
}

async function main({ batchSize }) {
  const nodes = (typeof rclient.nodes === 'function'
    ? rclient.nodes('master')
    : undefined) || [rclient]
  await scanNodes(nodes, batchSize)
}

let code = 0

main({ batchSize })
  .then(() => {
    logger.info({}, 'done')
  })
  .catch(error => {
    logger.error({ error }, 'error')
    code = 1
  })
  .finally(() => {
    rclient.quit().then(() => process.exit(code))
  })

import _ from 'lodash'
import OError from '@overleaf/o-error'
import logger from '@overleaf/logger'
import settings from '@overleaf/settings'
import metrics from '@overleaf/metrics'
import RedisWrapper from '@overleaf/redis-wrapper'
import Errors from './Errors.js'
import {
  fetchJson,
  fetchNothing,
  RequestFailedError,
} from '@overleaf/fetch-utils'
import { callbackify } from 'node:util'

const {
  ClientRequestedMissingOpsError,
  DocumentUpdaterRequestFailedError,
  NullBytesInOpError,
  UpdateTooLargeError,
} = Errors

const rclient = RedisWrapper.createClient(settings.redis.documentupdater)
const Keys = settings.redis.documentupdater.key_schema

async function getDocument(projectId, docId, fromVersion) {
  const timer = new metrics.Timer('get-document')
  const url = `${settings.apis.documentupdater.url}/project/${projectId}/doc/${docId}?fromVersion=${fromVersion}&historyOTSupport=true`
  logger.debug(
    { projectId, docId, fromVersion },
    'getting doc from document updater'
  )
  try {
    const body = await fetchJson(url)
    timer.done()
    logger.debug({ projectId, docId }, 'got doc from document document updater')
    return {
      lines: body?.lines,
      version: body?.version,
      ranges: body?.ranges,
      ops: body?.ops,
      ttlInS: body?.ttlInS,
      type: body?.type,
    }
  } catch (err) {
    timer.done()
    if (err instanceof RequestFailedError) {
      const { response, body } = err
      let parsedErrBody = null
      try {
        parsedErrBody = JSON.parse(body)
      } catch (error) {
        // ignore parse error
      }
      if (response.status === 422 && parsedErrBody?.firstVersionInRedis) {
        throw new ClientRequestedMissingOpsError(422, parsedErrBody)
      } else if ([404, 422].includes(response.status)) {
        throw new ClientRequestedMissingOpsError(response.status)
      } else {
        throw new DocumentUpdaterRequestFailedError(
          'getDocument',
          response.status
        )
      }
    }
    OError.tag(err, 'error getting doc from doc updater')
    throw err
  }
}

async function checkDocument(projectId, docId) {
  // in this call fromVersion = -1 means get document without docOps
  return await getDocument(projectId, docId, -1)
}

async function flushProjectToMongoAndDelete(projectId) {
  // this method is called when the last connected user leaves the project
  logger.debug({ projectId }, 'deleting project from document updater')
  const timer = new metrics.Timer('delete.mongo.project')
  // flush the project in the background when all users have left
  const url =
    `${settings.apis.documentupdater.url}/project/${projectId}?background=true` +
    (settings.shutDownInProgress ? '&shutdown=true' : '')

  try {
    await fetchNothing(url, { method: 'DELETE' })
    logger.debug({ projectId }, 'deleted project from document updater')
    timer.done()
  } catch (err) {
    timer.done()
    if (err instanceof RequestFailedError) {
      throw new DocumentUpdaterRequestFailedError(
        'flushProjectToMongoAndDelete',
        err.response.status
      )
    }
    OError.tag(err, 'error deleting project from document updater')
    throw err
  }
}

function _getPendingUpdateListKey() {
  const shard = _.random(0, settings.pendingUpdateListShardCount - 1)
  if (shard === 0) {
    return 'pending-updates-list'
  } else {
    return `pending-updates-list-${shard}`
  }
}

async function queueChange(projectId, docId, change) {
  const allowedKeys = ['doc', 'op', 'v', 'dupIfSource', 'meta', 'lastV', 'hash']
  change = _.pick(change, allowedKeys)
  const jsonChange = JSON.stringify(change)
  if (jsonChange.indexOf('\u0000') !== -1) {
    // memory corruption check
    throw new NullBytesInOpError(jsonChange)
  }

  const updateSize = jsonChange.length
  if (updateSize > settings.maxUpdateSize) {
    throw new UpdateTooLargeError(updateSize)
  }

  // record metric for each update added to queue
  metrics.summary('redis.pendingUpdates', updateSize, { status: 'push' })

  const docKey = `${projectId}:${docId}`
  // Push onto pendingUpdates for doc_id first, because once the doc updater
  // gets an entry on pending-updates-list, it starts processing.
  try {
    await rclient.rpush(Keys.pendingUpdates({ doc_id: docId }), jsonChange)
  } catch (error) {
    throw new OError('error pushing update into redis').withCause(error)
  }

  const queueKey = _getPendingUpdateListKey()
  try {
    await rclient.rpush(queueKey, docKey)
  } catch (error) {
    throw new OError('error pushing doc_id into redis')
      .withInfo({ queueKey })
      .withCause(error)
  }
}

export default {
  getDocument: callbackify(getDocument),
  checkDocument: callbackify(checkDocument),
  flushProjectToMongoAndDelete: callbackify(flushProjectToMongoAndDelete),
  _getPendingUpdateListKey,
  queueChange: callbackify(queueChange),
  promises: {
    getDocument,
    checkDocument,
    flushProjectToMongoAndDelete,
    queueChange,
  },
}

import request from 'request'
import _ from 'lodash'
import OError from '@overleaf/o-error'
import logger from '@overleaf/logger'
import settings from '@overleaf/settings'
import metrics from '@overleaf/metrics'
import RedisWrapper from '@overleaf/redis-wrapper'
import Errors from './Errors.js'

const {
  ClientRequestedMissingOpsError,
  DocumentUpdaterRequestFailedError,
  NullBytesInOpError,
  UpdateTooLargeError,
} = Errors
const rclient = RedisWrapper.createClient(settings.redis.documentupdater)
const Keys = settings.redis.documentupdater.key_schema

const DocumentUpdaterManager = {
  getDocument(projectId, docId, fromVersion, callback) {
    const timer = new metrics.Timer('get-document')
    const url = `${settings.apis.documentupdater.url}/project/${projectId}/doc/${docId}?fromVersion=${fromVersion}&historyOTSupport=true`
    logger.debug(
      { projectId, docId, fromVersion },
      'getting doc from document updater'
    )
    request.get(url, function (err, res, body) {
      timer.done()
      if (err) {
        OError.tag(err, 'error getting doc from doc updater')
        return callback(err)
      }
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logger.debug(
          { projectId, docId },
          'got doc from document document updater'
        )
        try {
          body = JSON.parse(body)
        } catch (error) {
          OError.tag(error, 'error parsing doc updater response')
          return callback(error)
        }
        body = body || {}
        callback(
          null,
          body.lines,
          body.version,
          body.ranges,
          body.ops,
          body.ttlInS,
          body.type
        )
      } else if (res.statusCode === 422 && body?.firstVersionInRedis) {
        callback(new ClientRequestedMissingOpsError(422, body))
      } else if ([404, 422].includes(res.statusCode)) {
        callback(new ClientRequestedMissingOpsError(res.statusCode))
      } else {
        callback(
          new DocumentUpdaterRequestFailedError('getDocument', res.statusCode)
        )
      }
    })
  },

  checkDocument(projectId, docId, callback) {
    // in this call fromVersion = -1 means get document without docOps
    DocumentUpdaterManager.getDocument(projectId, docId, -1, callback)
  },

  flushProjectToMongoAndDelete(projectId, callback) {
    // this method is called when the last connected user leaves the project
    logger.debug({ projectId }, 'deleting project from document updater')
    const timer = new metrics.Timer('delete.mongo.project')
    // flush the project in the background when all users have left
    const url =
      `${settings.apis.documentupdater.url}/project/${projectId}?background=true` +
      (settings.shutDownInProgress ? '&shutdown=true' : '')
    request.del(url, function (err, res) {
      timer.done()
      if (err) {
        OError.tag(err, 'error deleting project from document updater')
        callback(err)
      } else if (res.statusCode >= 200 && res.statusCode < 300) {
        logger.debug({ projectId }, 'deleted project from document updater')
        callback(null)
      } else {
        callback(
          new DocumentUpdaterRequestFailedError(
            'flushProjectToMongoAndDelete',
            res.statusCode
          )
        )
      }
    })
  },

  _getPendingUpdateListKey() {
    const shard = _.random(0, settings.pendingUpdateListShardCount - 1)
    if (shard === 0) {
      return 'pending-updates-list'
    } else {
      return `pending-updates-list-${shard}`
    }
  },

  queueChange(projectId, docId, change, callback) {
    const allowedKeys = [
      'doc',
      'op',
      'v',
      'dupIfSource',
      'meta',
      'lastV',
      'hash',
    ]
    change = _.pick(change, allowedKeys)
    const jsonChange = JSON.stringify(change)
    if (jsonChange.indexOf('\u0000') !== -1) {
      // memory corruption check
      return callback(new NullBytesInOpError(jsonChange))
    }

    const updateSize = jsonChange.length
    if (updateSize > settings.maxUpdateSize) {
      return callback(new UpdateTooLargeError(updateSize))
    }

    // record metric for each update added to queue
    metrics.summary('redis.pendingUpdates', updateSize, { status: 'push' })

    const docKey = `${projectId}:${docId}`
    // Push onto pendingUpdates for doc_id first, because once the doc updater
    // gets an entry on pending-updates-list, it starts processing.
    rclient.rpush(
      Keys.pendingUpdates({ doc_id: docId }),
      jsonChange,
      function (error) {
        if (error) {
          error = new OError('error pushing update into redis').withCause(error)
          return callback(error)
        }
        const queueKey = DocumentUpdaterManager._getPendingUpdateListKey()
        rclient.rpush(queueKey, docKey, function (error) {
          if (error) {
            error = new OError('error pushing doc_id into redis')
              .withInfo({ queueKey })
              .withCause(error)
          }
          callback(error)
        })
      }
    )
  },
}

export default DocumentUpdaterManager

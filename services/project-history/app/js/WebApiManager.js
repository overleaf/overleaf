import { promisify } from 'util'
import request from 'requestretry' // allow retry on error https://github.com/FGRibreau/node-request-retry
import logger from '@overleaf/logger'
import Metrics from '@overleaf/metrics'
import OError from '@overleaf/o-error'
import Settings from '@overleaf/settings'
import * as Errors from './Errors.js'
import * as RedisManager from './RedisManager.js'

// Don't let HTTP calls hang for a long time
const DEFAULT_MAX_HTTP_REQUEST_LENGTH = 16000 // 16 seconds

export function getHistoryId(projectId, callback) {
  Metrics.inc('history_id_cache_requests_total')
  RedisManager.getCachedHistoryId(projectId, (err, cachedHistoryId) => {
    if (err) return callback(err)
    if (cachedHistoryId) {
      Metrics.inc('history_id_cache_hits_total')
      callback(null, cachedHistoryId, true)
    } else {
      _getProjectDetails(projectId, function (error, project) {
        if (error) {
          return callback(error)
        }
        const historyId =
          project.overleaf &&
          project.overleaf.history &&
          project.overleaf.history.id
        if (historyId != null) {
          RedisManager.setCachedHistoryId(projectId, historyId, err => {
            if (err) return callback(err)
            callback(null, historyId, false)
          })
        } else {
          callback(null, historyId, false)
        }
      })
    }
  })
}

export function requestResync(projectId, callback) {
  const path = `/project/${projectId}/history/resync`
  _sendRequest(
    { path, timeout: 6 * 60000, maxAttempts: 1, method: 'POST' },
    callback
  )
}

function _getProjectDetails(projectId, callback) {
  const path = `/project/${projectId}/details`
  logger.debug({ projectId }, 'getting project details from web')
  _sendRequest({ path, json: true }, callback)
}

function _sendRequest(options, callback) {
  const url = `${Settings.apis.web.url}${options.path}`
  request(
    {
      method: options.method || 'GET',
      url,
      json: options.json || false,
      timeout: options.timeout || DEFAULT_MAX_HTTP_REQUEST_LENGTH,
      maxAttempts: options.maxAttempts || 2, // for node-request-retry
      auth: {
        user: Settings.apis.web.user,
        pass: Settings.apis.web.pass,
        sendImmediately: true,
      },
    },
    function (error, res, body) {
      if (error != null) {
        return callback(OError.tag(error))
      }
      if (res.statusCode === 404) {
        logger.debug({ url }, 'got 404 from web api')
        error = new Errors.NotFoundError('got a 404 from web api')
        return callback(error)
      }
      if (res.statusCode >= 200 && res.statusCode < 300) {
        callback(null, body)
      } else {
        error = new OError(
          `web returned a non-success status code: ${res.statusCode} (attempts: ${res.attempts})`,
          { url, res }
        )
        callback(error)
      }
    }
  )
}

export const promises = {
  getHistoryId: promisify(getHistoryId),
  requestResync: promisify(requestResync),
}

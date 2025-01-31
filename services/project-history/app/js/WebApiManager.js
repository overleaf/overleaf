import { callbackify } from 'node:util'
import { setTimeout } from 'node:timers/promises'
import logger from '@overleaf/logger'
import Metrics from '@overleaf/metrics'
import Settings from '@overleaf/settings'
import {
  fetchNothing,
  fetchJson,
  RequestFailedError,
} from '@overleaf/fetch-utils'
import * as Errors from './Errors.js'
import * as RedisManager from './RedisManager.js'

let RETRY_TIMEOUT_MS = 5000

async function getHistoryId(projectId) {
  Metrics.inc('history_id_cache_requests_total')
  const cachedHistoryId =
    await RedisManager.promises.getCachedHistoryId(projectId)
  if (cachedHistoryId) {
    Metrics.inc('history_id_cache_hits_total')
    return cachedHistoryId
  } else {
    const project = await _getProjectDetails(projectId)
    const historyId =
      project.overleaf &&
      project.overleaf.history &&
      project.overleaf.history.id
    if (historyId != null) {
      await RedisManager.promises.setCachedHistoryId(projectId, historyId)
    }
    return historyId
  }
}

async function requestResync(projectId, opts = {}) {
  try {
    const body = {}
    if (opts.historyRangesMigration) {
      body.historyRangesMigration = opts.historyRangesMigration
    }
    if (opts.resyncProjectStructureOnly) {
      body.resyncProjectStructureOnly = opts.resyncProjectStructureOnly
    }
    await fetchNothing(
      `${Settings.apis.web.url}/project/${projectId}/history/resync`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(6 * 60000),
        basicAuth: {
          user: Settings.apis.web.user,
          password: Settings.apis.web.pass,
        },
        json: body,
      }
    )
  } catch (err) {
    if (err instanceof RequestFailedError && err.response.status === 404) {
      throw new Errors.NotFoundError('got a 404 from web api').withCause(err)
    } else {
      throw err
    }
  }
}

async function _getProjectDetails(projectId, callback) {
  logger.debug({ projectId }, 'getting project details from web')
  let attempts = 0
  while (true) {
    attempts += 1
    try {
      return await fetchJson(
        `${Settings.apis.web.url}/project/${projectId}/details`,
        {
          signal: AbortSignal.timeout(16000),
          basicAuth: {
            user: Settings.apis.web.user,
            password: Settings.apis.web.pass,
          },
        }
      )
    } catch (err) {
      if (err instanceof RequestFailedError && err.response.status === 404) {
        throw new Errors.NotFoundError('got a 404 from web api').withCause(err)
      } else if (attempts < 2) {
        // retry after 5 seconds
        await setTimeout(RETRY_TIMEOUT_MS)
      } else {
        throw err
      }
    }
  }
}

/**
 * Adjust the retry timeout in tests
 */
export async function setRetryTimeoutMs(timeoutMs) {
  RETRY_TIMEOUT_MS = timeoutMs
}

// EXPORTS

const getHistoryIdCb = callbackify(getHistoryId)
const requestResyncCb = callbackify(requestResync)

export { getHistoryIdCb as getHistoryId, requestResyncCb as requestResync }

export const promises = {
  getHistoryId,
  requestResync,
}

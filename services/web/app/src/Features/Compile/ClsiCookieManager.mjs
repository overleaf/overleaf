import { URL, URLSearchParams } from 'node:url'
import OError from '@overleaf/o-error'
import Settings from '@overleaf/settings'
import {
  fetchNothing,
  fetchStringWithResponse,
  RequestFailedError,
} from '@overleaf/fetch-utils'
import RedisWrapper from '../../infrastructure/RedisWrapper.mjs'
import Cookie from 'cookie'
import logger from '@overleaf/logger'
import Metrics from '@overleaf/metrics'

const clsiCookiesEnabled = (Settings.clsiCookie?.key ?? '') !== ''

const rclient = RedisWrapper.client('clsi_cookie')
let rclientSecondary
if (Settings.redis.clsi_cookie_secondary != null) {
  rclientSecondary = RedisWrapper.client('clsi_cookie_secondary')
}

const ClsiCookieManagerFactory = function (backendGroup) {
  /**
   * @param {string} projectId
   * @param {string | null} userId
   * @param {string} compileBackendClass
   * @return {string}
   */
  function buildKey(projectId, userId, compileBackendClass) {
    if (backendGroup != null) {
      return `clsiserver:${backendGroup}:${compileBackendClass}:${projectId}:${userId}`
    } else {
      return `clsiserver:${compileBackendClass}:${projectId}:${userId}`
    }
  }

  async function getServerId(
    projectId,
    userId,
    compileGroup,
    compileBackendClass
  ) {
    if (!clsiCookiesEnabled) {
      return
    }
    const serverId = await rclient.get(
      buildKey(projectId, userId, compileBackendClass)
    )

    if (!serverId) {
      return await cookieManager.promises._populateServerIdViaRequest(
        projectId,
        userId,
        compileGroup,
        compileBackendClass
      )
    } else {
      return serverId
    }
  }

  async function _populateServerIdViaRequest(
    projectId,
    userId,
    compileGroup,
    compileBackendClass
  ) {
    const u = new URL(`${Settings.apis.clsi.url}/project/${projectId}/status`)
    u.search = new URLSearchParams({
      compileGroup,
      compileBackendClass,
    }).toString()
    let res
    try {
      res = await fetchNothing(u.href, {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
      })
    } catch (err) {
      OError.tag(err, 'error getting initial server id for project', {
        project_id: projectId,
      })
      throw err
    }

    if (!clsiCookiesEnabled) {
      return
    }
    const serverId = cookieManager._parseServerIdFromResponse(res)
    try {
      await cookieManager.promises.setServerId(
        projectId,
        userId,
        compileGroup,
        compileBackendClass,
        serverId,
        null
      )
      return serverId
    } catch (err) {
      logger.warn(
        { err, projectId },
        'error setting server id via populate request'
      )
      throw err
    }
  }

  function _parseServerIdFromResponse(response) {
    const cookies = Cookie.parse(response.headers['set-cookie']?.[0] || '')
    return cookies?.[Settings.clsiCookie.key]
  }

  async function checkIsLoadSheddingEvent(
    clsiserverid,
    compileGroup,
    compileBackendClass
  ) {
    let status
    try {
      const params = new URLSearchParams({
        clsiserverid,
        compileGroup,
        compileBackendClass,
      }).toString()
      const { response, body } = await fetchStringWithResponse(
        `${Settings.apis.clsi.url}/instance-state?${params}`,
        {
          method: 'GET',
          signal: AbortSignal.timeout(30_000),
        }
      )
      status =
        response.status === 200 && body === `${clsiserverid},UP\n`
          ? 'load-shedding'
          : 'cycle'
    } catch (err) {
      if (err instanceof RequestFailedError && err.response.status === 404) {
        status = 'cycle'
      } else {
        status = 'error'
        logger.warn({ err, clsiserverid }, 'cannot probe clsi VM')
      }
    }
    Metrics.inc('clsi-lb-switch-backend', 1, { status })
  }

  function _getTTLInSeconds(clsiServerId) {
    return (clsiServerId || '').includes('-reg-')
      ? Settings.clsiCookie.ttlInSecondsRegular
      : Settings.clsiCookie.ttlInSeconds
  }

  async function setServerId(
    projectId,
    userId,
    compileGroup,
    compileBackendClass,
    serverId,
    previous
  ) {
    if (!clsiCookiesEnabled) {
      return
    }
    if (serverId == null) {
      // We don't get a cookie back if it hasn't changed
      return await rclient.expire(
        buildKey(projectId, userId, compileBackendClass),
        _getTTLInSeconds(previous)
      )
    }
    if (!previous) {
      // Initial assignment of a user+project or after clearing cache.
      Metrics.inc('clsi-lb-assign-initial-backend')
    } else {
      await checkIsLoadSheddingEvent(
        previous,
        compileGroup,
        compileBackendClass
      )
    }
    if (rclientSecondary != null) {
      await _setServerIdInRedis(
        rclientSecondary,
        projectId,
        userId,
        compileBackendClass,
        serverId
      ).catch(() => {})
    }
    await _setServerIdInRedis(
      rclient,
      projectId,
      userId,
      compileBackendClass,
      serverId
    )
  }

  async function _setServerIdInRedis(
    rclient,
    projectId,
    userId,
    compileBackendClass,
    serverId
  ) {
    await rclient.setex(
      buildKey(projectId, userId, compileBackendClass),
      _getTTLInSeconds(serverId),
      serverId
    )
  }

  async function clearServerId(projectId, userId, compileBackendClass) {
    if (!clsiCookiesEnabled) {
      return
    }
    try {
      await rclient.del(buildKey(projectId, userId, compileBackendClass))
    } catch (err) {
      // redis errors need wrapping as the instance may be shared
      throw new OError(
        'Failed to clear clsi persistence',
        { projectId, userId },
        err
      )
    }
  }

  const cookieManager = {
    _parseServerIdFromResponse,
    promises: {
      getServerId,
      clearServerId,
      _populateServerIdViaRequest,
      setServerId,
    },
  }

  return cookieManager
}

export default ClsiCookieManagerFactory

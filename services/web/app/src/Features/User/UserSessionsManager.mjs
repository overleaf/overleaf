import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import _ from 'lodash'
import { callbackifyAll } from '@overleaf/promise-utils'
import UserSessionsRedis from './UserSessionsRedis.mjs'
const rclient = UserSessionsRedis.client()

const UserSessionsManager = {
  // mimic the key used by the express sessions
  _sessionKey(sessionId) {
    return `sess:${sessionId}`
  },

  async trackSession(user, sessionId) {
    if (!user) {
      return
    }
    if (!sessionId) {
      return
    }
    const sessionSetKey = UserSessionsRedis.sessionSetKey(user)
    const value = UserSessionsManager._sessionKey(sessionId)

    const multi = rclient.multi()
    multi.sadd(sessionSetKey, value)
    multi.pexpire(sessionSetKey, `${Settings.cookieSessionLength}`) // in milliseconds

    await multi.exec()

    UserSessionsManager._checkSessions(user).catch(err => {
      logger.error({ err }, 'Failed to check sessions in background')
    })
  },

  async untrackSession(user, sessionId) {
    if (!user) {
      return
    }
    if (!sessionId) {
      return
    }
    const sessionSetKey = UserSessionsRedis.sessionSetKey(user)
    const value = UserSessionsManager._sessionKey(sessionId)

    const multi = rclient.multi()
    multi.srem(sessionSetKey, value)
    multi.pexpire(sessionSetKey, `${Settings.cookieSessionLength}`) // in milliseconds

    await multi.exec()

    UserSessionsManager._checkSessions(user).catch(err => {
      logger.error({ err }, 'Failed to check sessions in background')
    })
  },

  async getAllUserSessions(user, exclude) {
    exclude = _.map(exclude, UserSessionsManager._sessionKey)
    const sessionSetKey = UserSessionsRedis.sessionSetKey(user)

    const sessionKeys = await rclient.smembers(sessionSetKey)

    const filteredSessionKeys = _.filter(
      sessionKeys,
      k => !_.includes(exclude, k)
    )
    if (filteredSessionKeys.length === 0) {
      logger.debug({ userId: user._id }, 'no other sessions found, returning')
      return []
    }

    // Use sequential processing to avoid overwhelming Redis
    const sessions = []
    for (const key of filteredSessionKeys) {
      const session = await rclient.get(key)
      sessions.push(session)
    }

    const result = []
    for (let session of sessions) {
      if (!session) {
        continue
      }
      session = JSON.parse(session)
      let sessionUser = session.passport && session.passport.user
      if (!sessionUser) {
        sessionUser = session.user
      }

      result.push({
        ip_address: sessionUser.ip_address,
        session_created: sessionUser.session_created,
      })
    }

    return result
  },

  /**
   * @param {{_id: string}} user
   * @param {string | null | undefined} retainSessionID - the session ID to exclude from deletion
   */
  async removeSessionsFromRedis(user, retainSessionID) {
    if (!user) {
      throw new Error('bug: user not passed to removeSessionsFromRedis')
    }
    const sessionSetKey = UserSessionsRedis.sessionSetKey(user)

    const sessionKeys = await rclient.smembers(sessionSetKey)

    const keysToDelete = retainSessionID
      ? _.without(sessionKeys, UserSessionsManager._sessionKey(retainSessionID))
      : sessionKeys

    if (keysToDelete.length === 0) {
      logger.debug(
        { userId: user._id },
        'no sessions in UserSessions set to delete, returning'
      )
      return 0
    }

    logger.debug(
      { userId: user._id, count: keysToDelete.length },
      'deleting sessions for user'
    )

    // Use sequential processing to avoid overwhelming Redis
    for (const key of keysToDelete) {
      await rclient.del(key)
    }

    await rclient.srem(sessionSetKey, keysToDelete)

    return keysToDelete.length
  },

  async touch(user) {
    if (!user) {
      return
    }
    const sessionSetKey = UserSessionsRedis.sessionSetKey(user)

    await rclient.pexpire(sessionSetKey, `${Settings.cookieSessionLength}`)
  },

  async _checkSessions(user) {
    if (!user) {
      return
    }
    const sessionSetKey = UserSessionsRedis.sessionSetKey(user)

    const sessionKeys = await rclient.smembers(sessionSetKey)

    // Use sequential processing to avoid overwhelming Redis
    for (const key of sessionKeys) {
      const val = await rclient.get(key)
      if (!val) {
        await rclient.srem(sessionSetKey, key)
      }
    }
  },
}

export default {
  ...callbackifyAll(UserSessionsManager),
  promises: UserSessionsManager,
}

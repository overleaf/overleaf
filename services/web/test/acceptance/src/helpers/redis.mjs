import UserSessionsRedis from '../../../../app/src/Features/User/UserSessionsRedis.mjs'

const rclient = UserSessionsRedis.client()

async function getUserSessions(user) {
  return await rclient.smembers(UserSessionsRedis.sessionSetKey(user))
}

async function clearUserSessions(user) {
  const sessionSetKey = UserSessionsRedis.sessionSetKey(user)
  const sessionKeys = await rclient.smembers(sessionSetKey)
  if (sessionKeys.length === 0) {
    return
  }
  for (const k of sessionKeys) {
    await rclient.del(k)
  }
  await rclient.srem(sessionSetKey, sessionKeys)
}

const RedisHelper = {
  getUserSessions,
  clearUserSessions,
}

export default RedisHelper

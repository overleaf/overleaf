import RedisWrapper from '../../infrastructure/RedisWrapper.mjs'
const rclient = RedisWrapper.client('websessions')

const UserSessionsRedis = {
  client() {
    return rclient
  },

  sessionSetKey(user) {
    return `UserSessions:{${user._id}}`
  },
}
export default UserSessionsRedis

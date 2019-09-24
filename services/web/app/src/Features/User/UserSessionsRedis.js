const RedisWrapper = require('../../infrastructure/RedisWrapper')
const rclient = RedisWrapper.client('websessions')

const UserSessionsRedis = {
  client() {
    return rclient
  },

  sessionSetKey(user) {
    return `UserSessions:{${user._id}}`
  }
}
module.exports = UserSessionsRedis

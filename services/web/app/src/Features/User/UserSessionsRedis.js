/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
let Redis
const RedisWrapper = require('../../infrastructure/RedisWrapper')
const rclient = RedisWrapper.client('websessions')

module.exports = Redis = {
  client() {
    return rclient
  },

  sessionSetKey(user) {
    return `UserSessions:{${user._id}}`
  }
}

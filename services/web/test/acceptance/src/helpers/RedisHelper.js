const RedisWrapper = require('../../../../app/src/infrastructure/RedisWrapper')
const client = RedisWrapper.client('ratelimiter')

module.exports = {
  initialize() {
    beforeEach('clear redis', function (done) {
      client.flushdb(done)
    })
  },
}

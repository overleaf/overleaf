const OError = require('@overleaf/o-error')

class RedisError extends OError {}
class RedisHealthCheckFailed extends RedisError {}
class RedisHealthCheckTimedOut extends RedisHealthCheckFailed {}
class RedisHealthCheckWriteError extends RedisHealthCheckFailed {}
class RedisHealthCheckVerifyError extends RedisHealthCheckFailed {}

module.exports = {
  RedisError,
  RedisHealthCheckFailed,
  RedisHealthCheckTimedOut,
  RedisHealthCheckWriteError,
  RedisHealthCheckVerifyError,
}

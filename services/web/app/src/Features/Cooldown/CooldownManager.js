const RedisWrapper = require('../../infrastructure/RedisWrapper')
const rclient = RedisWrapper.client('cooldown')
const logger = require('@overleaf/logger')
const { promisify } = require('@overleaf/promise-utils')

const COOLDOWN_IN_SECONDS = 60 * 10

const CooldownManager = {
  _buildKey(projectId) {
    return `Cooldown:{${projectId}}`
  },

  putProjectOnCooldown(projectId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    logger.debug(
      { projectId },
      `[Cooldown] putting project on cooldown for ${COOLDOWN_IN_SECONDS} seconds`
    )
    rclient.set(
      CooldownManager._buildKey(projectId),
      '1',
      'EX',
      COOLDOWN_IN_SECONDS,
      callback
    )
  },

  isProjectOnCooldown(projectId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    rclient.get(CooldownManager._buildKey(projectId), function (err, result) {
      if (err != null) {
        return callback(err)
      }
      return callback(null, result === '1')
    })
  },
}

CooldownManager.promises = {
  putProjectOnCooldown: promisify(CooldownManager.putProjectOnCooldown),
  isProjectOnCooldown: promisify(CooldownManager.isProjectOnCooldown),
}

module.exports = CooldownManager

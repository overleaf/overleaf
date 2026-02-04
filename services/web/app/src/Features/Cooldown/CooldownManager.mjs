import RedisWrapper from '../../infrastructure/RedisWrapper.mjs'
import logger from '@overleaf/logger'
const rclient = RedisWrapper.client('cooldown')

const COOLDOWN_IN_SECONDS = 60 * 10

const CooldownManager = {
  _buildKey(projectId) {
    return `Cooldown:{${projectId}}`
  },

  async putProjectOnCooldown(projectId) {
    logger.debug(
      { projectId },
      `[Cooldown] putting project on cooldown for ${COOLDOWN_IN_SECONDS} seconds`
    )
    await rclient.set(
      CooldownManager._buildKey(projectId),
      '1',
      'EX',
      COOLDOWN_IN_SECONDS
    )
  },

  async isProjectOnCooldown(projectId) {
    const result = await rclient.get(CooldownManager._buildKey(projectId))
    return result === '1'
  },
}

export default CooldownManager

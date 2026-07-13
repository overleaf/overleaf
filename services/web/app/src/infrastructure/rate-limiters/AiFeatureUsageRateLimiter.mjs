// @ts-check

import UserGetter from '../../Features/User/UserGetter.mjs'
import FeatureUsageRateLimiter from './FeatureUsageRateLimiter.mjs'
import Settings from '@overleaf/settings'
import FeaturesHelper from '../../Features/Subscription/FeaturesHelper.mjs'

class AiFeatureUsageRateLimiter extends FeatureUsageRateLimiter {
  constructor() {
    super('aiFeatureUsage')
  }

  /**
   * @param {string} userId
   * @returns {Promise<number>}
   */
  async _getAllowance(userId) {
    const user = await UserGetter.promises.getUser(userId, {
      features: 1,
      writefull: 1,
    })

    const wfQuota = user?.writefull?.isPremium
      ? Settings.writefull.quotaTierGranted
      : Settings.aiFeatures.freeQuota
    const mergedFeatures = FeaturesHelper.mergeFeatures(user?.features, {
      aiUsageQuota: wfQuota,
    })
    const quotaTier = mergedFeatures.aiUsageQuota
    return _quotaTierToAllowance(quotaTier)
  }
}

/**
 * Maps a quota tier identifier to its corresponding numeric allowance
 * using the configured quota grants for AI features.
 *
 * @param {string} quotaTier - The quota tier identifier for the user
 * @returns {number} The numeric allowance for the given tier
 */
function _quotaTierToAllowance(quotaTier) {
  const quota = Settings.quotaGrants.ai[quotaTier]
  if (typeof quota !== 'number') {
    throw new Error(`Quota tier "${quotaTier}" is not initialized in settings`)
  }
  return Math.floor(quota)
}

export default new AiFeatureUsageRateLimiter()

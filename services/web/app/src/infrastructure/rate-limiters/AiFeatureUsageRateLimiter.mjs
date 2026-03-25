// @ts-check

import UserGetter from '../../Features/User/UserGetter.mjs'
import FeatureUsageRateLimiter from './FeatureUsageRateLimiter.mjs'
import Settings from '@overleaf/settings'
import SplitTestHandler from '../../Features/SplitTests/SplitTestHandler.mjs'
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
    // todo: quota clean-up: remove aiErrorAssistant checking, and split test
    const inQuotaSplitTest =
      await SplitTestHandler.promises.featureFlagEnabledForUser(
        userId,
        'plans-2026-phase-1'
      )

    if (inQuotaSplitTest) {
      const wfQuota = user.writefull?.isPremium
        ? Settings.writefull.quotaTierGranted
        : Settings.aiFeatures.freeTrialQuota
      const mergedFeatures = FeaturesHelper.mergeFeatures(user.features, {
        aiUsageQuota: wfQuota,
      })
      const quotaTier = mergedFeatures.aiUsageQuota
      return _quotaTierToAllowance(quotaTier)
    } else {
      const DEFAULT_ALLOWANCE = 1
      const ADD_ON_ALLOWANCE = 200
      const hasAddOn =
        user?.features?.aiErrorAssistant || user?.writefull?.isPremium
      return hasAddOn ? ADD_ON_ALLOWANCE : DEFAULT_ALLOWANCE
    }
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
  if (!quota || typeof quota !== 'number') {
    throw new Error(`Quota tier "${quotaTier}" is not initialized in settings`)
  }
  return Math.floor(quota)
}

export default new AiFeatureUsageRateLimiter()

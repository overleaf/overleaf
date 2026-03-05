// @ts-check
import SplitTestHandler from '../../Features/SplitTests/SplitTestHandler.mjs'
import UserGetter from '../../Features/User/UserGetter.mjs'
import TokenUsageRateLimiter from './TokenUsageRateLimiter.mjs'
/** @typedef {{usage?: number | null, periodStart?: Date | null}} FeatureUsage */

const DEFAULT_USER_TOKEN_ALLOWANCE = 8_000_000
const ALPHA_USER_TOKEN_ALLOWANCE = 8_000_000

class WorkbenchRateLimiter extends TokenUsageRateLimiter {
  constructor() {
    super('aiWorkbench')
  }

  /**
   * @param {string} userId
   * @returns {Promise<number>}
   */
  async _getAllowance(userId) {
    const splitTestAssignment =
      await SplitTestHandler.promises.getAssignmentForUser(
        userId,
        'ai-workbench-release'
      )
    const inSplitTest = splitTestAssignment.variant === 'enabled'
    if (!inSplitTest) {
      return 0
    }
    const user = await UserGetter.promises.getUser(userId, {
      features: 1,
      writefull: 1,
      alphaProgram: 1,
    })

    if (user?.alphaProgram) {
      return ALPHA_USER_TOKEN_ALLOWANCE
    }

    // todo: quota clean-up: remove split test
    let hasAddOn
    const inQuotaSplitTest =
      await SplitTestHandler.promises.featureFlagEnabledForUser(
        userId,
        'plans-2026-phase-1'
      )
    if (inQuotaSplitTest) {
      // post rollout, all users have the same token limit (fair usage)
      return DEFAULT_USER_TOKEN_ALLOWANCE
    } else {
      hasAddOn = user.features.aiErrorAssistant || user.writefull?.isPremium
      return hasAddOn ? DEFAULT_USER_TOKEN_ALLOWANCE : 0
    }
  }
}
export default new WorkbenchRateLimiter()

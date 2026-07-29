// @ts-check
import TokenUsageRateLimiter from './TokenUsageRateLimiter.mjs'
/** @typedef {{usage?: number | null, periodStart?: Date | null}} FeatureUsage */

const DEFAULT_USER_TOKEN_ALLOWANCE = 8_000_000
class WorkbenchRateLimiter extends TokenUsageRateLimiter {
  constructor() {
    super('aiWorkbench')
  }

  /**
   * @param {string} userId
   * @returns {Promise<number>}
   */
  async _getAllowance(userId) {
    // all users have the same token limit (fair usage)
    return DEFAULT_USER_TOKEN_ALLOWANCE
  }
}
export default new WorkbenchRateLimiter()

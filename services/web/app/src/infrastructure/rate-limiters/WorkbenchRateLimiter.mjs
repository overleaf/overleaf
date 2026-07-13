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
      alphaProgram: 1,
    })

    if (user?.alphaProgram) {
      return ALPHA_USER_TOKEN_ALLOWANCE
    }

    // all users have the same token limit (fair usage)
    return DEFAULT_USER_TOKEN_ALLOWANCE
  }
}
export default new WorkbenchRateLimiter()

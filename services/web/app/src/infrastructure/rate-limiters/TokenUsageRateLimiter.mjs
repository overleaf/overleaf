// @ts-check
import { UserFeatureUsage } from '../../models/UserFeatureUsage.mjs'
import { TooManyRequestsError } from '../../Features/Errors/Errors.js'
import AnalyticsManager from '../../Features/Analytics/AnalyticsManager.mjs'
/** @typedef {{usage?: number | null, periodStart?: Date | null}} FeatureUsage */
/** @typedef {{remainingTokens?: number | null, periodStart?: Date | null}} RemainingTokens */

const PERIOD = 24 // hours
const PERIOD_IN_MILLISECONDS = PERIOD * 60 * 60 * 1000

// todo: quota clean-up: extend this off base RateLimitController and unify behaviour where possible.

export default class TokenUsageRateLimiter {
  /**
   * @param {string} featureName
   */
  constructor(featureName) {
    this.featureName = featureName
  }

  _resetFeatureUsagePipelineSection() {
    return {
      $set: {
        features: {
          [this.featureName]: {
            $cond: {
              if: {
                $lte: [
                  {
                    $dateAdd: {
                      startDate: `$features.${this.featureName}.periodStart`,
                      unit: 'hour',
                      amount: PERIOD,
                    },
                  },
                  '$$NOW',
                ],
              },
              then: {
                usage: 0,
                periodStart: '$$NOW',
              },
              else: `$features.${this.featureName}`,
            },
          },
        },
      },
    }
  }

  /**
   *
   * @param {string} _userId
   * @returns {Promise<number>}
   */
  async _getAllowance(_userId) {
    throw new Error('_getAllowance must be implemented by subclasses')
  }

  async recordUsage(userId, res, amount) {
    const allowance = await this._getAllowance(userId)

    const featureUsages = await UserFeatureUsage.findOneAndUpdate(
      { _id: userId },
      [
        this._resetFeatureUsagePipelineSection(),
        {
          $set: {
            features: {
              [this.featureName]: {
                usage: {
                  $add: [`$features.${this.featureName}.usage`, amount],
                },
              },
            },
          },
        },
      ],
      {
        new: true,
        upsert: true,
      }
    ).exec()

    const featureUsage = featureUsages.features?.[this.featureName] ?? {}
    this.setRateLimitHeaders(res, featureUsage, allowance)
  }

  /**
   *
   * @param {string} userId
   * @returns {Promise<FeatureUsage>}
   */
  async getCurrentUsage(userId) {
    const reportedUsage = await UserFeatureUsage.findOne({ _id: userId }).exec()
    const featureUsage = reportedUsage?.features?.[this.featureName] ?? {}
    return {
      usage: featureUsage.usage ?? 0,
      periodStart: featureUsage.periodStart ?? new Date(),
    }
  }

  /**
   * Gets the remaining token allowance for a user within the current period.
   *
   * @param {string} userId - The user ID to check remaining tokens for
   * @returns {Promise<RemainingTokens>}
   *   Object with feature name as key and remaining usage details as value.
   *   If the current period has expired, returns the full allowance.
   *   If no userId provided, returns 0 remaining usage.
   */
  async getRemainingTokens(userId) {
    const allowance = await this._getAllowance(userId)
    const reportedUsage = await UserFeatureUsage.findOne({ _id: userId }).exec()
    const featureUsage = reportedUsage?.features?.[this.featureName] ?? {}
    const periodStart = featureUsage.periodStart ?? new Date()
    const usage = featureUsage.usage ?? 0
    const usesLeft = allowance - usage
    const refreshEpoch = periodStart.getTime() + PERIOD_IN_MILLISECONDS
    return {
      [this.featureName]: {
        remainingTokens: Date.now() > refreshEpoch ? allowance : usesLeft,
        resetDate: new Date(refreshEpoch).toString(),
      },
    }
  }

  /**
   *
   * @param {string} userId
   * @param {import('express').Response} res
   */
  async checkUsage(userId, res) {
    const allowance = await this._getAllowance(userId)
    const currentUsage = await this.getCurrentUsage(userId)
    const periodStart = currentUsage.periodStart ?? new Date()
    if (periodStart.getTime() + PERIOD_IN_MILLISECONDS <= Date.now()) {
      // Period has expired, so reset usage
      currentUsage.usage = 0
      currentUsage.periodStart = new Date()
    }
    this.setRateLimitHeaders(res, currentUsage, allowance)
    if ((currentUsage.usage ?? 0) >= allowance) {
      await AnalyticsManager.recordEventForUser(
        userId,
        'ai-token-usage-limit-exceeded'
      )

      throw new TooManyRequestsError({
        message: `${this.featureName} rate limit exceeded`,
        info: {
          userId,
        },
      })
    }
  }

  /**
   *
   * @param {import('express').Response} res
   * @param {FeatureUsage} featureUsage
   * @param {number} allowance
   */
  setRateLimitHeaders(res, featureUsage, allowance) {
    const periodStart = featureUsage.periodStart ?? new Date()
    const usage = featureUsage.usage ?? 0
    const refreshEpoch = periodStart.getTime() + PERIOD_IN_MILLISECONDS
    const secondsTillReset = Math.ceil((refreshEpoch - Date.now()) / 1000)

    if (!res.headersSent) {
      res.set('Token-RateLimit-Limit', allowance.toString())
      res.set(
        'Token-RateLimit-Remaining',
        Math.max(0, allowance - usage).toString()
      )
      res.set('Token-RateLimit-Reset', Math.max(0, secondsTillReset).toString())
    }
  }

  /**
   * Calculates a weighted token usage based on cost incurred for different token
   * types.
   *
   * @param {import('ai').LanguageModelUsage} tokenUsage
   * @return {number}
   */
  calculateTokenUsage(tokenUsage) {
    const {
      outputTokens,
      inputTokenDetails: { noCacheTokens, cacheReadTokens },
    } = tokenUsage

    return Math.ceil(
      (noCacheTokens ?? 0) +
        (outputTokens ?? 0) * 10 +
        (cacheReadTokens ?? 0) * 0.1
    )
  }
}

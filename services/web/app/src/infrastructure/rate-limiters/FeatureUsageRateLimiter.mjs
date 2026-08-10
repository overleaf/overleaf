// @ts-check

import { UserFeatureUsage } from '../../models/UserFeatureUsage.mjs'
import { TooManyRequestsError } from '../../Features/Errors/Errors.js'

const PERIOD = 24 // hours
const PERIOD_IN_MILLISECONDS = PERIOD * 60 * 60 * 1000

/**
 * @class FeatureUsageRateLimiter
 * @abstract
 * @description A rate limiter for features based on usage data stored in the
 * UserFeatureUsage collection.
 */
export default class FeatureUsageRateLimiter {
  /**
   * @param {string} featureName
   */
  constructor(featureName) {
    this.featureName = featureName
  }

  resetFeatureUsagePipelineSection() {
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
   * @param {string} userId
   * @param {import('express').Response} res
   * @param {number} [cost] - the amount to increment the users usage by, may be 0 for features that are quota locked but dont consume any uses
   * @param {{ auditLogTool?: string }} [options] - passed through to the `_onFeatureUsed` hook for subclasses to react to
   */
  async useFeature(userId, res, cost = 1, options = {}) {
    const allowance = await this._getAllowance(userId)

    const featureUsages = await UserFeatureUsage.findOneAndUpdate(
      { _id: userId },
      [
        this.resetFeatureUsagePipelineSection(),
        {
          $set: {
            features: {
              [this.featureName]: {
                usage: {
                  $cond: {
                    if: {
                      $lte: [`$features.${this.featureName}.usage`, allowance],
                    },
                    then: {
                      $add: [`$features.${this.featureName}.usage`, cost],
                    },
                    else: `$features.${this.featureName}.usage`,
                  },
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

    const featureUsage =
      /** @type {Record<string, any>} */ (featureUsages.features ?? {})[
        this.featureName
      ] ?? {}

    setRateLimitHeaders(res, featureUsage, allowance)

    await this._onFeatureUsed(userId, res, featureUsage, allowance, options)

    this._checkRateLimit(featureUsage, allowance)
  }

  /**
   * Hook fired after usage is recorded, before the rate-limit check runs.
   * No-op by default; subclasses override to react to the post-usage state.
   *
   * @param {string} _userId
   * @param {import('express').Response} _res
   * @param {{periodStart?: Date, usage?: number}} _featureUsage
   * @param {number} _allowance
   * @param {{auditLogTool?: string}} _options
   */
  async _onFeatureUsed(_userId, _res, _featureUsage, _allowance, _options) {}

  /**
   * Records that the user reached their limit this period. Returns true only for
   * the first at-limit request of the period: the `$ne: periodStart` filter
   * matches once and writes; later requests in the same period no-op and return
   * false. Best-effort: a failed write returns false and never throws.
   *
   * @param {string} userId
   * @param {Date} periodStart
   * @returns {Promise<boolean>} whether this was the first reach of the period
   */
  async _recordFirstLimitReach(userId, periodStart) {
    const result = await UserFeatureUsage.updateOne(
      {
        _id: userId,
        [`features.${this.featureName}.limitReachedPeriodStart`]: {
          $ne: periodStart,
        },
      },
      {
        $set: {
          [`features.${this.featureName}.limitReachedPeriodStart`]: periodStart,
        },
      }
    )
      .exec()
      .catch(() => null)
    return result?.modifiedCount === 1
  }

  /**
   *
   * @param {string} userId
   * @param {import('express').Response} res
   */
  async decrementFeatureUsage(userId, res, cost = 1) {
    const allowance = await this._getAllowance(userId)
    const featureUsages = await UserFeatureUsage.findOneAndUpdate(
      { _id: userId },
      [
        this.resetFeatureUsagePipelineSection(),
        {
          $set: {
            [`features.${this.featureName}.usage`]: {
              $add: [`$features.${this.featureName}.usage`, -cost],
            },
          },
        },
      ],
      {
        new: true,
        upsert: true,
      }
    ).exec()

    const featureUsage =
      /** @type {Record<string, any>} */ (featureUsages.features ?? {})[
        this.featureName
      ] ?? {}
    setRateLimitHeaders(res, featureUsage, allowance)
  }

  /**
   * @param {string} userId
   */
  async resetFeatureUsage(userId) {
    await UserFeatureUsage.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          [`features.${this.featureName}`]: {
            usage: 0,
            periodStart: new Date(),
          },
        },
      },
      { upsert: true }
    ).exec()
  }

  /**
   * @param {string} userId
   * @returns {Promise<{[featureName: string]: { remainingUsage: number, resetDate?: string}}>}
   */
  async getRemainingFeatureUses(userId) {
    const allowance = await this._getAllowance(userId)
    const reportedUsage = await UserFeatureUsage.findOne({ _id: userId }).exec()
    const featureUsage =
      /** @type {Record<string, any>} */ (reportedUsage?.features ?? {})[
        this.featureName
      ] ?? {}
    const periodStart = featureUsage.periodStart ?? new Date()
    const usage = featureUsage.usage ?? 0
    const refreshEpoch = periodStart.getTime() + PERIOD_IN_MILLISECONDS
    const periodExpired = refreshEpoch <= Date.now()
    const remainingUsage = periodExpired ? allowance : allowance - usage
    // This date isn't exactly correct when computed before an actual feature usage
    const resetDate = new Date(
      periodExpired ? Date.now() + PERIOD_IN_MILLISECONDS : refreshEpoch
    ).toString()
    return {
      [this.featureName]: {
        remainingUsage: Math.max(remainingUsage, 0),
        resetDate,
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

  /**
   *
   * @param {{periodStart?: Date, usage?: number}} featureUsage
   * @param {number} allowance
   */
  _checkRateLimit(featureUsage, allowance) {
    const periodStart = featureUsage.periodStart ?? new Date()
    const usage = featureUsage.usage ?? 0
    const refreshEpoch = periodStart.getTime() + PERIOD_IN_MILLISECONDS
    const pastUsageLimit = usage > allowance && refreshEpoch > Date.now()

    if (pastUsageLimit) {
      throw new TooManyRequestsError(`${this.featureName} rate limit exceeded`)
    }
  }
}

/**
 *
 * @param {import('express').Response} res
 * @param {{periodStart?: Date, usage?: number}} featureUsage
 * @param {number} allowance
 */
function setRateLimitHeaders(res, featureUsage, allowance) {
  const periodStart = featureUsage.periodStart ?? new Date()
  const usage = featureUsage.usage ?? 0
  const refreshEpoch = periodStart.getTime() + PERIOD_IN_MILLISECONDS
  const secondsTillReset = Math.ceil((refreshEpoch - Date.now()) / 1000)
  if (!res.headersSent) {
    res.set('RateLimit-Limit', String(allowance))
    res.set('RateLimit-Remaining', String(Math.max(0, allowance - usage)))
    res.set('RateLimit-Reset', String(Math.max(0, secondsTillReset)))
  }
}

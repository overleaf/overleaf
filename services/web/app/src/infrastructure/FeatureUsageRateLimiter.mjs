// @ts-check

import { UserFeatureUsage } from '../models/UserFeatureUsage.mjs'
import { TooManyRequestsError } from '../Features/Errors/Errors.js'

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
   * @param {string} userId
   * @param {import('express').Response} res
   */
  async useFeature(userId, res) {
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
                  $cond: {
                    if: {
                      $lte: [`$features.${this.featureName}.usage`, allowance],
                    },
                    then: {
                      $add: [`$features.${this.featureName}.usage`, 1],
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

    const featureUsage = featureUsages.features?.[this.featureName] ?? {}
    setRateLimitHeaders(res, featureUsage, allowance)
    this._checkRateLimit(featureUsage, allowance)
  }

  /**
   *
   * @param {string} userId
   * @param {import('express').Response} res
   */
  async decrementFeatureUsage(userId, res) {
    const allowance = await this._getAllowance(userId)
    const featureUsages = await UserFeatureUsage.findOneAndUpdate(
      { _id: userId },
      [
        this._resetFeatureUsagePipelineSection(),
        {
          $set: {
            [`features.${this.featureName}.usage`]: {
              $add: [`$features.${this.featureName}.usage`, -1],
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
    setRateLimitHeaders(res, featureUsage, allowance)
  }

  /**
   * @param {string} userId
   * @returns {Promise<{[featureName: string]: { remainingUsage: number, resetDate?: string}}>}
   */
  async getRemainingFeatureUses(userId) {
    if (!userId) {
      return { [this.featureName]: { remainingUsage: 0 } }
    }

    const allowance = await this._getAllowance(userId)
    const reportedUsage = await UserFeatureUsage.findOne({ _id: userId }).exec()
    const featureUsage = reportedUsage?.features?.[this.featureName] ?? {}
    const periodStart = featureUsage.periodStart ?? new Date()
    const usage = featureUsage.usage ?? 0
    const usesLeft = allowance - usage
    const refreshEpoch = periodStart.getTime() + PERIOD_IN_MILLISECONDS
    return {
      [this.featureName]: {
        remainingUsage: Date.now() > refreshEpoch ? allowance : usesLeft,
        resetDate: new Date(refreshEpoch).toString(),
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
      throw new TooManyRequestsError(
        `${this.featureName} assistant rate limit exceeded`
      )
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

// ts-check
import crypto from 'node:crypto'

import SurveyCache from './SurveyCache.mjs'
import SubscriptionLocator from '../Subscription/SubscriptionLocator.js'
import { callbackify } from '@overleaf/promise-utils'
import UserGetter from '../User/UserGetter.js'

/**
 * @import { Survey } from '../../../../types/project/dashboard/survey'
 */

/**
 * determines if there is a survey to show, given current surveys and rollout percentages
 * uses userId in computation, to ensure that rollout groups always contain same users
 * @param {string} userId
 * @returns {Promise<Survey | undefined>}
 */
async function getSurvey(userId) {
  const survey = await SurveyCache.get(true)
  if (survey) {
    if (survey.options?.hasRecurlyGroupSubscription) {
      const hasRecurlyGroupSubscription =
        await SubscriptionLocator.promises.hasRecurlyGroupSubscription(userId)
      if (!hasRecurlyGroupSubscription) {
        return
      }
    }

    const { name, preText, linkText, url, options } = survey?.toObject() || {}
    // default to full rollout for backwards compatibility
    const rolloutPercentage = options?.rolloutPercentage || 100
    if (!_userInRolloutPercentile(userId, name, rolloutPercentage)) {
      return
    }

    const { earliestSignupDate, latestSignupDate } = survey.options || {}
    if (earliestSignupDate || latestSignupDate) {
      const user = await UserGetter.promises.getUser(userId, { signUpDate: 1 })
      if (!user) {
        return
      }
      const { signUpDate } = user
      if (latestSignupDate) {
        // Make the check inclusive
        latestSignupDate.setHours(23, 59, 59, 999)
        if (signUpDate > latestSignupDate) {
          return
        }
      }
      if (earliestSignupDate && signUpDate < earliestSignupDate) {
        return
      }
    }

    return { name, preText, linkText, url }
  }
}

function _userRolloutPercentile(userId, surveyName) {
  const hash = crypto
    .createHash('md5')
    .update(userId + surveyName)
    .digest('hex')
  const hashPrefix = hash.substring(0, 8)
  return Math.floor(
    ((parseInt(hashPrefix, 16) % 0xffffffff) / 0xffffffff) * 100
  )
}

function _userInRolloutPercentile(userId, surveyName, rolloutPercentage) {
  if (rolloutPercentage === 100) {
    return true
  }
  const userPercentile = _userRolloutPercentile(userId, surveyName)
  return userPercentile < rolloutPercentage
}

export default {
  getSurvey: callbackify(getSurvey),
  promises: {
    getSurvey,
  },
}

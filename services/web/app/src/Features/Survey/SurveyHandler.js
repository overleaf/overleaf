const SurveyCache = require('./SurveyCache')
const SubscriptionLocator = require('../Subscription/SubscriptionLocator')
const { callbackify } = require('../../util/promises')

/**
 * @typedef {import('../../../../types/project/dashboard/survey').Survey} Survey
 */

/**
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
    const { name, preText, linkText, url } = survey?.toObject() || {}
    return { name, preText, linkText, url }
  }
}

module.exports = {
  getSurvey: callbackify(getSurvey),
  promises: {
    getSurvey,
  },
}

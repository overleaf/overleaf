const _ = require('lodash')
const { callbackify } = require('util')
const { callbackifyMultiResult } = require('../../util/promises')
const PlansLocator = require('./PlansLocator')
const SubscriptionLocator = require('./SubscriptionLocator')
const UserFeaturesUpdater = require('./UserFeaturesUpdater')
const FeaturesHelper = require('./FeaturesHelper')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const ReferalFeatures = require('../Referal/ReferalFeatures')
const V1SubscriptionManager = require('./V1SubscriptionManager')
const InstitutionsFeatures = require('../Institutions/InstitutionsFeatures')
const UserGetter = require('../User/UserGetter')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const Queues = require('../../infrastructure/Queues')

/**
 * Enqueue a job for refreshing features for the given user
 */
async function scheduleRefreshFeatures(userId, reason) {
  const queue = Queues.getQueue('refresh-features')
  await queue.add({ userId, reason })
}

/* Check if user features refresh if needed, based on the global featuresEpoch setting */
function featuresEpochIsCurrent(user) {
  return Settings.featuresEpoch
    ? user.featuresEpoch === Settings.featuresEpoch
    : true
}

/**
 * Refresh features for the given user
 */
async function refreshFeatures(userId, reason) {
  const user = await UserGetter.promises.getUser(userId, {
    _id: 1,
    features: 1,
  })
  const oldFeatures = _.clone(user.features)
  const features = await computeFeatures(userId)
  logger.log({ userId, features }, 'updating user features')

  const matchedFeatureSet = FeaturesHelper.getMatchedFeatureSet(features)
  AnalyticsManager.setUserPropertyForUser(
    userId,
    'feature-set',
    matchedFeatureSet
  )

  const { features: newFeatures, featuresChanged } =
    await UserFeaturesUpdater.promises.updateFeatures(userId, features)
  if (oldFeatures.dropbox === true && features.dropbox === false) {
    logger.log({ userId }, '[FeaturesUpdater] must unlink dropbox')
    const Modules = require('../../infrastructure/Modules')
    try {
      await Modules.promises.hooks.fire('removeDropbox', userId, reason)
    } catch (err) {
      logger.error(err)
    }
  }
  return { features: newFeatures, featuresChanged }
}

/**
 * Return the features that the given user should have.
 */
async function computeFeatures(userId) {
  const individualFeatures = await _getIndividualFeatures(userId)
  const groupFeatureSets = await _getGroupFeatureSets(userId)
  const institutionFeatures =
    await InstitutionsFeatures.promises.getInstitutionsFeatures(userId)
  const user = await UserGetter.promises.getUser(userId, {
    featuresOverrides: 1,
    'overleaf.id': 1,
  })
  const v1Features = await _getV1Features(user)
  const bonusFeatures = await ReferalFeatures.promises.getBonusFeatures(userId)
  const featuresOverrides = await _getFeaturesOverrides(user)
  logger.log(
    {
      userId,
      individualFeatures,
      groupFeatureSets,
      institutionFeatures,
      v1Features,
      bonusFeatures,
      featuresOverrides,
    },
    'merging user features'
  )
  const featureSets = groupFeatureSets.concat([
    individualFeatures,
    institutionFeatures,
    v1Features,
    bonusFeatures,
    featuresOverrides,
  ])
  const features = _.reduce(
    featureSets,
    FeaturesHelper.mergeFeatures,
    Settings.defaultFeatures
  )
  return features
}

async function _getIndividualFeatures(userId) {
  const sub = await SubscriptionLocator.promises.getUserIndividualSubscription(
    userId
  )
  return _subscriptionToFeatures(sub)
}

async function _getGroupFeatureSets(userId) {
  const subs = await SubscriptionLocator.promises.getGroupSubscriptionsMemberOf(
    userId
  )
  return (subs || []).map(_subscriptionToFeatures)
}

async function _getFeaturesOverrides(user) {
  if (!user || !user.featuresOverrides || user.featuresOverrides.length === 0) {
    return {}
  }
  const activeFeaturesOverrides = []
  for (const featuresOverride of user.featuresOverrides) {
    if (
      !featuresOverride.expiresAt ||
      featuresOverride.expiresAt > new Date()
    ) {
      activeFeaturesOverrides.push(featuresOverride.features)
    }
  }
  const features = _.reduce(
    activeFeaturesOverrides,
    FeaturesHelper.mergeFeatures,
    {}
  )
  return features
}

async function _getV1Features(user) {
  const v1Id = user?.overleaf?.id
  return V1SubscriptionManager.getGrandfatheredFeaturesForV1User(v1Id) || {}
}

function _subscriptionToFeatures(subscription) {
  return _planCodeToFeatures(subscription && subscription.planCode)
}

function _planCodeToFeatures(planCode) {
  if (!planCode) {
    return {}
  }
  const plan = PlansLocator.findLocalPlanInSettings(planCode)
  if (!plan) {
    return {}
  } else {
    return plan.features
  }
}

async function doSyncFromV1(v1UserId) {
  logger.log({ v1UserId }, '[AccountSync] starting account sync')
  const user = await UserGetter.promises.getUser(
    { 'overleaf.id': v1UserId },
    { _id: 1 }
  )
  if (user == null) {
    logger.warn({ v1UserId }, '[AccountSync] no user found for v1 id')
    return
  }
  logger.log(
    { v1UserId, userId: user._id },
    '[AccountSync] updating user subscription and features'
  )
  return refreshFeatures(user._id, 'sync-v1')
}

module.exports = {
  featuresEpochIsCurrent,
  computeFeatures: callbackify(computeFeatures),
  refreshFeatures: callbackifyMultiResult(refreshFeatures, [
    'features',
    'featuresChanged',
  ]),
  doSyncFromV1: callbackifyMultiResult(doSyncFromV1, [
    'features',
    'featuresChanged',
  ]),
  scheduleRefreshFeatures: callbackify(scheduleRefreshFeatures),
  promises: {
    computeFeatures,
    refreshFeatures,
    scheduleRefreshFeatures,
    doSyncFromV1,
  },
}

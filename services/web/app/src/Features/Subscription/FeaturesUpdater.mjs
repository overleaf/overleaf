import _ from 'lodash'
import { callbackify } from 'node:util'
import { callbackifyMultiResult } from '@overleaf/promise-utils'
import PlansLocator from './PlansLocator.mjs'
import SubscriptionLocator from './SubscriptionLocator.mjs'
import SubscriptionHelper from './SubscriptionHelper.mjs'
import UserFeaturesUpdater from './UserFeaturesUpdater.mjs'
import FeaturesHelper from './FeaturesHelper.mjs'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import ReferalFeatures from '../Referal/ReferalFeatures.mjs'
import V1SubscriptionManager from './V1SubscriptionManager.mjs'
import InstitutionsFeatures from '../Institutions/InstitutionsFeatures.mjs'
import UserGetter from '../User/UserGetter.mjs'
import AnalyticsManager from '../Analytics/AnalyticsManager.mjs'
import Queues from '../../infrastructure/Queues.mjs'
import Modules from '../../infrastructure/Modules.mjs'
import { AI_ADD_ON_CODE } from './AiHelper.mjs'
import { fetchNothing } from '@overleaf/fetch-utils'

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
  logger.debug({ userId, features, reason }, 'updating user features')

  const matchedFeatureSet = FeaturesHelper.getMatchedFeatureSet(features)
  AnalyticsManager.setUserPropertyForUserInBackground(
    userId,
    'feature-set',
    matchedFeatureSet
  )

  const { features: newFeatures, featuresChanged } =
    await UserFeaturesUpdater.promises.updateFeatures(userId, features)
  if (oldFeatures.dropbox === true && features.dropbox === false) {
    logger.debug({ userId }, '[FeaturesUpdater] must unlink dropbox')
    try {
      await Modules.promises.hooks.fire('removeDropbox', userId, reason)
    } catch (err) {
      logger.error({ err, userId }, 'removeDropbox hook failed')
    }
  }

  if (oldFeatures.github === true && features.github === false) {
    logger.debug({ userId }, '[FeaturesUpdater] must unlink github')
    try {
      await Modules.promises.hooks.fire('removeGithub', userId, reason)
    } catch (err) {
      logger.error({ err, userId }, 'removeGithub hook failed')
    }
  }

  // only update Writefull if the user's features have changed,
  //  skip if they are the reason we are refreshing features (they'd already be up to date)
  if (featuresChanged && reason !== 'writefullEntitlementSynced') {
    try {
      // update WF with the current feature set for the user
      await fetchNothing(
        `${Settings.writefull.overleafApiUrl}/api/user/status/update-overleaf-status`,
        {
          headers: {
            'x-api-key': Settings.writefull.overleafApiKey,
          },
          json: {
            userOverleafId: userId,
            hasAiAssist: newFeatures.aiErrorAssistant,
          },
          method: 'POST',
        }
      )
    } catch (err) {
      // continue with sync even if we cant communicate with wf
      logger.warn(
        { userId, reason },
        'failed to sync entitlement to Writefull after a feature refresh'
      )
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
  logger.debug(
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
  return _.reduce(
    featureSets,
    FeaturesHelper.mergeFeatures,
    Settings.defaultFeatures
  )
}

async function _getIndividualFeatures(userId) {
  const subscription =
    await SubscriptionLocator.promises.getUsersSubscription(userId)
  if (
    subscription == null ||
    SubscriptionHelper.getPaidSubscriptionState(subscription) === 'paused' ||
    subscription.userFeaturesDisabled
  ) {
    return {}
  }

  const featureSets = []

  // The plan doesn't apply to the group admin when the subscription
  // is a group subscription
  if (!subscription.groupPlan) {
    featureSets.push(_subscriptionToFeatures(subscription))
  }

  featureSets.push(_aiAddOnFeatures(subscription))
  return _.reduce(featureSets, FeaturesHelper.mergeFeatures, {})
}

async function _getGroupFeatureSets(userId) {
  const subs =
    await SubscriptionLocator.promises.getGroupSubscriptionsMemberOf(userId)
  return (subs || [])
    .filter(sub => sub.userFeaturesDisabled !== true)
    .map(_subscriptionToFeatures)
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
  return _.reduce(activeFeaturesOverrides, FeaturesHelper.mergeFeatures, {})
}

async function _getV1Features(user) {
  const v1Id = user?.overleaf?.id
  return V1SubscriptionManager.getGrandfatheredFeaturesForV1User(v1Id) || {}
}

function _subscriptionToFeatures(subscription) {
  if (!subscription?.planCode) {
    return {}
  }
  const plan = PlansLocator.findLocalPlanInSettings(subscription.planCode)
  if (!plan) {
    return {}
  } else {
    return plan.features
  }
}

function _aiAddOnFeatures(subscription) {
  if (subscription?.addOns?.some(addOn => addOn.addOnCode === AI_ADD_ON_CODE)) {
    return { aiErrorAssistant: true }
  } else {
    return {}
  }
}

async function doSyncFromV1(v1UserId) {
  logger.debug({ v1UserId }, '[AccountSync] starting account sync')
  const user = await UserGetter.promises.getUser(
    { 'overleaf.id': v1UserId },
    { _id: 1 }
  )
  if (user == null) {
    logger.warn({ v1UserId }, '[AccountSync] no user found for v1 id')
    return
  }
  logger.debug(
    { v1UserId, userId: user._id },
    '[AccountSync] updating user subscription and features'
  )
  return refreshFeatures(user._id, 'sync-v1')
}

export default {
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

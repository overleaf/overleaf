/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let FeaturesUpdater
const async = require('async')
const PlansLocator = require('./PlansLocator')
const _ = require('underscore')
const SubscriptionLocator = require('./SubscriptionLocator')
const UserFeaturesUpdater = require('./UserFeaturesUpdater')
const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const ReferalFeatures = require('../Referal/ReferalFeatures')
const V1SubscriptionManager = require('./V1SubscriptionManager')
const InstitutionsFeatures = require('../Institutions/InstitutionsFeatures')
const UserGetter = require('../User/UserGetter')

const oneMonthInSeconds = 60 * 60 * 24 * 30

module.exports = FeaturesUpdater = {
  refreshFeatures(user_id, callback) {
    if (callback == null) {
      callback = function(error, features, featuresChanged) {}
    }

    const jobs = {
      individualFeatures(cb) {
        return FeaturesUpdater._getIndividualFeatures(user_id, cb)
      },
      groupFeatureSets(cb) {
        return FeaturesUpdater._getGroupFeatureSets(user_id, cb)
      },
      institutionFeatures(cb) {
        return InstitutionsFeatures.getInstitutionsFeatures(user_id, cb)
      },
      v1Features(cb) {
        return FeaturesUpdater._getV1Features(user_id, cb)
      },
      bonusFeatures(cb) {
        return ReferalFeatures.getBonusFeatures(user_id, cb)
      },
      samlFeatures(cb) {
        return FeaturesUpdater._getSamlFeatures(user_id, cb)
      }
    }
    return async.series(jobs, function(err, results) {
      if (err != null) {
        logger.warn(
          { err, user_id },
          'error getting subscription or group for refreshFeatures'
        )
        return callback(err)
      }

      const {
        individualFeatures,
        groupFeatureSets,
        institutionFeatures,
        v1Features,
        bonusFeatures,
        samlFeatures
      } = results
      logger.log(
        {
          user_id,
          individualFeatures,
          groupFeatureSets,
          institutionFeatures,
          v1Features,
          bonusFeatures,
          samlFeatures
        },
        'merging user features'
      )
      const featureSets = groupFeatureSets.concat([
        individualFeatures,
        institutionFeatures,
        v1Features,
        bonusFeatures,
        samlFeatures
      ])
      const features = _.reduce(
        featureSets,
        FeaturesUpdater._mergeFeatures,
        Settings.defaultFeatures
      )

      logger.log({ user_id, features }, 'updating user features')
      return UserFeaturesUpdater.updateFeatures(user_id, features, callback)
    })
  },

  _getIndividualFeatures(user_id, callback) {
    if (callback == null) {
      callback = function(error, features) {}
    }
    return SubscriptionLocator.getUsersSubscription(user_id, (err, sub) =>
      callback(err, FeaturesUpdater._subscriptionToFeatures(sub))
    )
  },

  _getGroupFeatureSets(user_id, callback) {
    if (callback == null) {
      callback = function(error, featureSets) {}
    }
    return SubscriptionLocator.getGroupSubscriptionsMemberOf(
      user_id,
      (err, subs) =>
        callback(err, (subs || []).map(FeaturesUpdater._subscriptionToFeatures))
    )
  },

  _getSamlFeatures(user_id, callback) {
    UserGetter.getUser(user_id, (err, user) => {
      if (err) {
        return callback(err)
      }
      if (
        !user ||
        !Array.isArray(user.samlIdentifiers) ||
        !user.samlIdentifiers.length
      ) {
        return callback(null, {})
      }
      for (const samlIdentifier of user.samlIdentifiers) {
        if (samlIdentifier && samlIdentifier.hasEntitlement) {
          return callback(
            null,
            FeaturesUpdater._planCodeToFeatures('professional')
          )
        }
      }
      return callback(null, {})
    })
  },

  _getV1Features(user_id, callback) {
    if (callback == null) {
      callback = function(error, features) {}
    }
    return V1SubscriptionManager.getPlanCodeFromV1(user_id, function(
      err,
      planCode,
      v1Id
    ) {
      if (err != null) {
        if ((err != null ? err.name : undefined) === 'NotFoundError') {
          return callback(null, [])
        }
        return callback(err)
      }

      return callback(
        err,
        FeaturesUpdater._mergeFeatures(
          V1SubscriptionManager.getGrandfatheredFeaturesForV1User(v1Id) || {},
          FeaturesUpdater._planCodeToFeatures(planCode)
        )
      )
    })
  },

  _mergeFeatures(featuresA, featuresB) {
    const features = Object.assign({}, featuresA)
    for (let key in featuresB) {
      // Special merging logic for non-boolean features
      const value = featuresB[key]
      if (key === 'compileGroup') {
        if (
          features['compileGroup'] === 'priority' ||
          featuresB['compileGroup'] === 'priority'
        ) {
          features['compileGroup'] = 'priority'
        } else {
          features['compileGroup'] = 'standard'
        }
      } else if (key === 'collaborators') {
        if (
          features['collaborators'] === -1 ||
          featuresB['collaborators'] === -1
        ) {
          features['collaborators'] = -1
        } else {
          features['collaborators'] = Math.max(
            features['collaborators'] || 0,
            featuresB['collaborators'] || 0
          )
        }
      } else if (key === 'compileTimeout') {
        features['compileTimeout'] = Math.max(
          features['compileTimeout'] || 0,
          featuresB['compileTimeout'] || 0
        )
      } else {
        // Boolean keys, true is better
        features[key] = features[key] || featuresB[key]
      }
    }
    return features
  },

  _subscriptionToFeatures(subscription) {
    return FeaturesUpdater._planCodeToFeatures(
      subscription != null ? subscription.planCode : undefined
    )
  },

  _planCodeToFeatures(planCode) {
    if (planCode == null) {
      return {}
    }
    const plan = PlansLocator.findLocalPlanInSettings(planCode)
    if (plan == null) {
      return {}
    } else {
      return plan.features
    }
  }
}

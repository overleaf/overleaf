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

const FeaturesUpdater = {
  refreshFeatures(userId, callback = () => {}) {
    FeaturesUpdater._computeFeatures(userId, (error, features) => {
      if (error) {
        return callback(error)
      }
      logger.log({ userId, features }, 'updating user features')
      UserFeaturesUpdater.updateFeatures(userId, features, callback)
    })
  },

  _computeFeatures(userId, callback) {
    const jobs = {
      individualFeatures(cb) {
        FeaturesUpdater._getIndividualFeatures(userId, cb)
      },
      groupFeatureSets(cb) {
        FeaturesUpdater._getGroupFeatureSets(userId, cb)
      },
      institutionFeatures(cb) {
        InstitutionsFeatures.getInstitutionsFeatures(userId, cb)
      },
      v1Features(cb) {
        FeaturesUpdater._getV1Features(userId, cb)
      },
      bonusFeatures(cb) {
        ReferalFeatures.getBonusFeatures(userId, cb)
      },
      samlFeatures(cb) {
        FeaturesUpdater._getSamlFeatures(userId, cb)
      },
      featuresOverrides(cb) {
        FeaturesUpdater._getFeaturesOverrides(userId, cb)
      }
    }
    async.series(jobs, function(err, results) {
      if (err) {
        logger.warn(
          { err, userId },
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
        samlFeatures,
        featuresOverrides
      } = results
      logger.log(
        {
          userId,
          individualFeatures,
          groupFeatureSets,
          institutionFeatures,
          v1Features,
          bonusFeatures,
          samlFeatures,
          featuresOverrides
        },
        'merging user features'
      )
      const featureSets = groupFeatureSets.concat([
        individualFeatures,
        institutionFeatures,
        v1Features,
        bonusFeatures,
        samlFeatures,
        featuresOverrides
      ])
      const features = _.reduce(
        featureSets,
        FeaturesUpdater._mergeFeatures,
        Settings.defaultFeatures
      )
      callback(null, features)
    })
  },

  _getIndividualFeatures(userId, callback) {
    SubscriptionLocator.getUserIndividualSubscription(userId, (err, sub) =>
      callback(err, FeaturesUpdater._subscriptionToFeatures(sub))
    )
  },

  _getGroupFeatureSets(userId, callback) {
    SubscriptionLocator.getGroupSubscriptionsMemberOf(userId, (err, subs) =>
      callback(err, (subs || []).map(FeaturesUpdater._subscriptionToFeatures))
    )
  },

  _getSamlFeatures(userId, callback) {
    UserGetter.getUser(userId, (err, user) => {
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
      callback(null, {})
    })
  },

  _getFeaturesOverrides(userId, callback) {
    UserGetter.getUser(userId, { featuresOverrides: 1 }, (error, user) => {
      if (error) {
        return callback(error)
      }
      if (
        !user ||
        !user.featuresOverrides ||
        user.featuresOverrides.length === 0
      ) {
        return callback(null, {})
      }
      let activeFeaturesOverrides = []
      for (let featuresOverride of user.featuresOverrides) {
        if (
          !featuresOverride.expiresAt ||
          featuresOverride.expiresAt > new Date()
        ) {
          activeFeaturesOverrides.push(featuresOverride.features)
        }
      }
      const features = _.reduce(
        activeFeaturesOverrides,
        FeaturesUpdater._mergeFeatures,
        {}
      )
      callback(null, features)
    })
  },

  _getV1Features(userId, callback) {
    V1SubscriptionManager.getPlanCodeFromV1(userId, function(
      err,
      planCode,
      v1Id
    ) {
      if (err) {
        if ((err ? err.name : undefined) === 'NotFoundError') {
          return callback(null, [])
        }
        return callback(err)
      }

      callback(
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
      subscription ? subscription.planCode : undefined
    )
  },

  _planCodeToFeatures(planCode) {
    if (!planCode) {
      return {}
    }
    const plan = PlansLocator.findLocalPlanInSettings(planCode)
    if (!plan) {
      return {}
    } else {
      return plan.features
    }
  },

  compareFeatures(currentFeatures, expectedFeatures) {
    currentFeatures = _.clone(currentFeatures)
    expectedFeatures = _.clone(expectedFeatures)
    if (_.isEqual(currentFeatures, expectedFeatures)) {
      return {}
    }

    let mismatchReasons = {}
    const featureKeys = [
      ...new Set([
        ...Object.keys(currentFeatures),
        ...Object.keys(expectedFeatures)
      ])
    ]
    featureKeys.sort().forEach(key => {
      if (expectedFeatures[key] !== currentFeatures[key]) {
        mismatchReasons[key] = expectedFeatures[key]
      }
    })

    if (mismatchReasons.compileTimeout) {
      // store the compile timeout difference instead of the new compile timeout
      mismatchReasons.compileTimeout =
        expectedFeatures.compileTimeout - currentFeatures.compileTimeout
    }

    if (mismatchReasons.collaborators) {
      // store the collaborators difference instead of the new number only
      // replace -1 by 100 to make it clearer
      if (expectedFeatures.collaborators === -1) {
        expectedFeatures.collaborators = 100
      }
      if (currentFeatures.collaborators === -1) {
        currentFeatures.collaborators = 100
      }
      mismatchReasons.collaborators =
        expectedFeatures.collaborators - currentFeatures.collaborators
    }

    return mismatchReasons
  },

  doSyncFromV1(v1UserId, callback) {
    logger.log({ v1UserId }, '[AccountSync] starting account sync')
    return UserGetter.getUser({ 'overleaf.id': v1UserId }, { _id: 1 }, function(
      err,
      user
    ) {
      if (err != null) {
        logger.warn({ v1UserId }, '[AccountSync] error getting user')
        return callback(err)
      }
      if ((user != null ? user._id : undefined) == null) {
        logger.warn({ v1UserId }, '[AccountSync] no user found for v1 id')
        return callback(null)
      }
      logger.log(
        { v1UserId, userId: user._id },
        '[AccountSync] updating user subscription and features'
      )
      return FeaturesUpdater.refreshFeatures(user._id, callback)
    })
  }
}

const refreshFeaturesPromise = userId =>
  new Promise(function(resolve, reject) {
    FeaturesUpdater.refreshFeatures(
      userId,
      (error, features, featuresChanged) => {
        if (error) {
          reject(error)
        } else {
          resolve({ features, featuresChanged })
        }
      }
    )
  })

FeaturesUpdater.promises = {
  refreshFeatures: refreshFeaturesPromise
}

module.exports = FeaturesUpdater

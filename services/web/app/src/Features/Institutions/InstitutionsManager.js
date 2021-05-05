const async = require('async')
const _ = require('underscore')
const { ObjectId } = require('mongodb')
const { getInstitutionAffiliations } = require('./InstitutionsAPI')
const FeaturesUpdater = require('../Subscription/FeaturesUpdater')
const UserGetter = require('../User/UserGetter')
const SAMLIdentityManager = require('../User/SAMLIdentityManager')
const NotificationsBuilder = require('../Notifications/NotificationsBuilder')
const SubscriptionLocator = require('../Subscription/SubscriptionLocator')
const { Institution } = require('../../models/Institution')
const { Subscription } = require('../../models/Subscription')
const OError = require('@overleaf/o-error')

const ASYNC_LIMIT = parseInt(process.env.ASYNC_LIMIT, 10) || 5
module.exports = {
  refreshInstitutionUsers(institutionId, notify, callback) {
    const refreshFunction = notify ? refreshFeaturesAndNotify : refreshFeatures
    async.waterfall(
      [
        cb => fetchInstitutionAndAffiliations(institutionId, cb),
        function (institution, affiliations, cb) {
          affiliations = _.map(affiliations, function (affiliation) {
            affiliation.institutionName = institution.name
            affiliation.institutionId = institutionId
            return affiliation
          })
          async.eachLimit(affiliations, ASYNC_LIMIT, refreshFunction, err =>
            cb(err)
          )
        },
      ],
      callback
    )
  },

  checkInstitutionUsers(institutionId, callback) {
    getInstitutionAffiliations(institutionId, (error, affiliations) => {
      if (error) {
        return callback(error)
      }
      UserGetter.getUsersByAnyConfirmedEmail(
        affiliations.map(affiliation => affiliation.email),
        { features: 1, samlIdentifiers: 1 },
        (error, users) => {
          if (error) return callback(OError.tag(error))
          callback(error, checkFeatures(institutionId, users))
        }
      )
    })
  },

  getInstitutionUsersSubscriptions(institutionId, callback) {
    getInstitutionAffiliations(institutionId, function (error, affiliations) {
      if (error) {
        return callback(error)
      }
      const userIds = affiliations.map(affiliation =>
        ObjectId(affiliation.user_id)
      )
      Subscription.find({
        admin_id: userIds,
        planCode: { $not: /trial/ },
      })
        .populate('admin_id', 'email')
        .exec(callback)
    })
  },
}

var fetchInstitutionAndAffiliations = (institutionId, callback) =>
  async.waterfall(
    [
      cb =>
        Institution.findOne({ v1Id: institutionId }, (err, institution) =>
          cb(err, institution)
        ),
      (institution, cb) =>
        institution.fetchV1Data((err, institution) => cb(err, institution)),
      (institution, cb) =>
        getInstitutionAffiliations(institutionId, (err, affiliations) =>
          cb(err, institution, affiliations)
        ),
    ],
    callback
  )

var refreshFeatures = function (affiliation, callback) {
  const userId = ObjectId(affiliation.user_id)
  FeaturesUpdater.refreshFeatures(userId, callback)
}

var refreshFeaturesAndNotify = function (affiliation, callback) {
  const userId = ObjectId(affiliation.user_id)
  async.waterfall(
    [
      cb =>
        FeaturesUpdater.refreshFeatures(
          userId,
          (err, features, featuresChanged) => cb(err, featuresChanged)
        ),
      (featuresChanged, cb) =>
        getUserInfo(userId, (error, user, subscription) =>
          cb(error, user, subscription, featuresChanged)
        ),
      (user, subscription, featuresChanged, cb) =>
        notifyUser(user, affiliation, subscription, featuresChanged, cb),
    ],
    callback
  )
}

var getUserInfo = (userId, callback) =>
  async.waterfall(
    [
      cb => UserGetter.getUser(userId, cb),
      (user, cb) =>
        SubscriptionLocator.getUsersSubscription(user, (err, subscription) =>
          cb(err, user, subscription)
        ),
    ],
    callback
  )

var notifyUser = (user, affiliation, subscription, featuresChanged, callback) =>
  async.parallel(
    [
      function (cb) {
        if (featuresChanged) {
          NotificationsBuilder.featuresUpgradedByAffiliation(
            affiliation,
            user
          ).create(cb)
        } else {
          cb()
        }
      },
      function (cb) {
        if (
          subscription &&
          !subscription.planCode.match(/(free|trial)/) &&
          !subscription.groupPlan
        ) {
          NotificationsBuilder.redundantPersonalSubscription(
            affiliation,
            user
          ).create(cb)
        } else {
          cb()
        }
      },
    ],
    callback
  )

var checkFeatures = function (institutionId, users) {
  const usersSummary = {
    confirmedEmailUsers: {
      total: users.length, // all users are confirmed email users
      totalProUsers: 0,
      totalNonProUsers: 0,
      nonProUsers: [],
    },
    entitledSSOUsers: {
      total: 0,
      totalProUsers: 0,
      totalNonProUsers: 0,
      nonProUsers: [],
    },
  }
  users.forEach(function (user) {
    const isSSOEntitled = SAMLIdentityManager.userHasEntitlement(
      user,
      institutionId
    )

    if (isSSOEntitled) {
      usersSummary.entitledSSOUsers.total += 1
    }

    if (user.features.collaborators === -1 && user.features.trackChanges) {
      // user is on Pro
      usersSummary.confirmedEmailUsers.totalProUsers += 1
      if (isSSOEntitled) {
        usersSummary.entitledSSOUsers.totalProUsers += 1
      }
    } else {
      // user is not on Pro
      usersSummary.confirmedEmailUsers.totalNonProUsers += 1
      usersSummary.confirmedEmailUsers.nonProUsers.push(user._id)
      if (isSSOEntitled) {
        usersSummary.entitledSSOUsers.totalNonProUsers += 1
        usersSummary.entitledSSOUsers.nonProUsers.push(user._id)
      }
    }
  })
  return usersSummary
}

/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
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
let InstitutionsManager
const logger = require('logger-sharelatex')
const async = require('async')
const { db } = require('../../infrastructure/mongojs')
const _ = require('underscore')
const { ObjectId } = require('../../infrastructure/mongojs')
const { getInstitutionAffiliations } = require('./InstitutionsAPI')
const FeaturesUpdater = require('../Subscription/FeaturesUpdater')
const UserGetter = require('../User/UserGetter')
const NotificationsBuilder = require('../Notifications/NotificationsBuilder')
const SubscriptionLocator = require('../Subscription/SubscriptionLocator')
const { Institution } = require('../../models/Institution')
const { Subscription } = require('../../models/Subscription')

const ASYNC_LIMIT = 10
module.exports = InstitutionsManager = {
  upgradeInstitutionUsers(institutionId, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return async.waterfall(
      [
        cb => fetchInstitutionAndAffiliations(institutionId, cb),
        function(institution, affiliations, cb) {
          affiliations = _.map(affiliations, function(affiliation) {
            affiliation.institutionName = institution.name
            affiliation.institutionId = institutionId
            return affiliation
          })
          return async.eachLimit(
            affiliations,
            ASYNC_LIMIT,
            refreshFeatures,
            err => cb(err)
          )
        }
      ],
      callback
    )
  },

  checkInstitutionUsers(institutionId, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return getInstitutionAffiliations(institutionId, (error, affiliations) =>
      UserGetter.getUsersByAnyConfirmedEmail(
        affiliations.map(affiliation => affiliation.email),
        { features: 1 },
        (error, users) => callback(error, checkFeatures(users))
      )
    )
  },

  getInstitutionUsersSubscriptions(institutionId, callback) {
    if (callback == null) {
      callback = function(error, subscriptions) {}
    }
    return getInstitutionAffiliations(institutionId, function(
      error,
      affiliations
    ) {
      if (error != null) {
        return callback(error)
      }
      const userIds = affiliations.map(affiliation =>
        ObjectId(affiliation.user_id)
      )
      return Subscription.find({
        admin_id: userIds,
        planCode: { $not: /trial/ }
      })
        .populate('admin_id', 'email')
        .exec(callback)
    })
  }
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
        )
    ],
    callback
  )

var refreshFeatures = function(affiliation, callback) {
  const userId = ObjectId(affiliation.user_id)
  return async.waterfall(
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
        notifyUser(user, affiliation, subscription, featuresChanged, cb)
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
        )
    ],
    callback
  )

var notifyUser = (user, affiliation, subscription, featuresChanged, callback) =>
  async.parallel(
    [
      function(cb) {
        if (featuresChanged) {
          return NotificationsBuilder.featuresUpgradedByAffiliation(
            affiliation,
            user
          ).create(cb)
        } else {
          return cb()
        }
      },
      function(cb) {
        if (
          subscription != null &&
          subscription.planCode.match(/(free|trial)/) == null &&
          !subscription.groupPlan
        ) {
          return NotificationsBuilder.redundantPersonalSubscription(
            affiliation,
            user
          ).create(cb)
        } else {
          return cb()
        }
      }
    ],
    callback
  )

var checkFeatures = function(users) {
  const usersSummary = {
    totalConfirmedUsers: users.length,
    totalConfirmedProUsers: 0,
    totalConfirmedNonProUsers: 0,
    confirmedNonProUsers: []
  }
  users.forEach(function(user) {
    if (user.features.collaborators === -1 && user.features.trackChanges) {
      return (usersSummary.totalConfirmedProUsers += 1)
    } else {
      usersSummary.totalConfirmedNonProUsers += 1
      return usersSummary.confirmedNonProUsers.push(user._id)
    }
  })
  return usersSummary
}

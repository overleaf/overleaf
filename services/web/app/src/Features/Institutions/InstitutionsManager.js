const async = require('async')
const { callbackify, promisify } = require('util')
const { ObjectId } = require('mongodb')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const fetch = require('node-fetch')
const {
  getInstitutionAffiliations,
  getConfirmedInstitutionAffiliations,
  promises: InstitutionsAPIPromises,
} = require('./InstitutionsAPI')
const FeaturesUpdater = require('../Subscription/FeaturesUpdater')
const FeaturesHelper = require('../Subscription/FeaturesHelper')
const UserGetter = require('../User/UserGetter')
const NotificationsBuilder = require('../Notifications/NotificationsBuilder')
const NotificationsHandler = require('../Notifications/NotificationsHandler')
const SubscriptionLocator = require('../Subscription/SubscriptionLocator')
const { Institution } = require('../../models/Institution')
const { Subscription } = require('../../models/Subscription')

const ASYNC_LIMIT = parseInt(process.env.ASYNC_LIMIT, 10) || 5

async function _getSsoUsers(institutionId, lapsedUserIds) {
  let currentNotEntitledCount = 0
  const ssoNonEntitledUsersIds = []
  const allSsoUsersByIds = {}

  const allSsoUsers = await UserGetter.promises.getSsoUsersAtInstitution(
    institutionId,
    { samlIdentifiers: 1 }
  )
  allSsoUsers.forEach(user => {
    allSsoUsersByIds[user._id] = user.samlIdentifiers.find(
      identifer => identifer.providerId === institutionId.toString()
    )
  })
  for (const userId in allSsoUsersByIds) {
    if (!allSsoUsersByIds[userId].hasEntitlement) {
      ssoNonEntitledUsersIds.push(userId)
    }
  }
  if (ssoNonEntitledUsersIds.length > 0) {
    currentNotEntitledCount = ssoNonEntitledUsersIds.filter(
      id => !lapsedUserIds.includes(id)
    ).length
  }

  return {
    allSsoUsers,
    allSsoUsersByIds,
    currentNotEntitledCount,
  }
}

async function _checkUsersFeatures(userIds) {
  const users = await UserGetter.promises.getUsers(userIds, { features: 1 })
  const result = {
    proUserIds: [],
    nonProUserIds: [],
  }

  users.forEach(user => {
    const hasProFeaturesOrBetter = FeaturesHelper.isFeatureSetBetter(
      user.features,
      Settings.features.professional
    )

    if (hasProFeaturesOrBetter) {
      result.proUserIds.push(user._id)
    } else {
      result.nonProUserIds.push(user._id)
    }
  })

  return result
}

async function checkInstitutionUsers(institutionId, emitNonProUserIds) {
  /*
    v1 has affiliation data. Via getInstitutionAffiliationsCounts, v1 will send
    lapsed_user_ids, which includes all user types
    (not linked, linked and entitled, linked not entitled).
    However, for SSO institutions, it does not know which email is linked
    to SSO when the license is non-trivial. Here we need to split that
    lapsed count into SSO (entitled and not) or just email users
  */

  const result = {
    emailUsers: {
      total: 0, // v1 all users - v2 all SSO users
      current: 0, // v1 current - v1 SSO entitled - (v2 calculated not entitled current)
      lapsed: 0, // v1 lapsed user IDs that are not in v2 SSO users
      pro: {
        current: 0,
        lapsed: 0,
      },
      nonPro: {
        current: 0,
        lapsed: 0,
      },
    },
    ssoUsers: {
      total: 0, // only v2
      current: {
        entitled: 0, // only v1
        notEntitled: 0, // v2 non-entitled SSO users - v1 lapsed user IDs
      },
      lapsed: 0, // v2 SSO users that are in v1 lapsed user IDs
      pro: {
        current: 0,
        lapsed: 0,
      },
      nonPro: {
        current: 0,
        lapsed: 0,
      },
    },
  }

  const {
    user_ids: userIds, // confirmed and not removed users. Includes users with lapsed reconfirmations
    current_users_count: currentUsersCount, // all users not with lapsed reconfirmations
    lapsed_user_ids: lapsedUserIds, // includes all user types that did not reconfirm (sso entitled, sso not entitled, email only)
    with_confirmed_email: withConfirmedEmail, // same count as affiliation metrics
    entitled_via_sso: entitled, // same count as affiliation metrics
  } = await InstitutionsAPIPromises.getInstitutionAffiliationsCounts(
    institutionId
  )
  result.ssoUsers.current.entitled = entitled

  const { allSsoUsers, allSsoUsersByIds, currentNotEntitledCount } =
    await _getSsoUsers(institutionId, lapsedUserIds)
  result.ssoUsers.total = allSsoUsers.length
  result.ssoUsers.current.notEntitled = currentNotEntitledCount

  // check if lapsed user ID an SSO user
  const lapsedUsersByIds = {}
  lapsedUserIds.forEach(id => {
    lapsedUsersByIds[id] = true // create a map for more performant lookups
    if (allSsoUsersByIds[id]) {
      ++result.ssoUsers.lapsed
    } else {
      ++result.emailUsers.lapsed
    }
  })

  result.emailUsers.current =
    currentUsersCount - entitled - result.ssoUsers.current.notEntitled
  result.emailUsers.total = userIds.length - allSsoUsers.length

  // compare v1 and v2 counts.
  if (
    result.ssoUsers.current.notEntitled + result.emailUsers.current !==
    withConfirmedEmail
  ) {
    result.databaseMismatch = {
      withConfirmedEmail: {
        v1: withConfirmedEmail,
        v2: result.ssoUsers.current.notEntitled + result.emailUsers.current,
      },
    }
  }

  // Add Pro/NonPro status for users
  // NOTE: Users not entitled via institution could have Pro via another method
  const { proUserIds, nonProUserIds } = await _checkUsersFeatures(userIds)
  proUserIds.forEach(id => {
    const userType = lapsedUsersByIds[id] ? 'lapsed' : 'current'
    if (allSsoUsersByIds[id]) {
      result.ssoUsers.pro[userType]++
    } else {
      result.emailUsers.pro[userType]++
    }
  })
  nonProUserIds.forEach(id => {
    const userType = lapsedUsersByIds[id] ? 'lapsed' : 'current'
    if (allSsoUsersByIds[id]) {
      result.ssoUsers.nonPro[userType]++
    } else {
      result.emailUsers.nonPro[userType]++
    }
  })
  if (emitNonProUserIds) {
    result.nonProUserIds = nonProUserIds
  }
  return result
}

const InstitutionsManager = {
  clearInstitutionNotifications(institutionId, dryRun, callback) {
    function clear(key, cb) {
      const run = dryRun
        ? NotificationsHandler.previewMarkAsReadByKeyOnlyBulk
        : NotificationsHandler.markAsReadByKeyOnlyBulk

      run(key, cb)
    }

    async.series(
      {
        ipMatcherAffiliation(cb) {
          const key = `ip-matched-affiliation-${institutionId}`
          clear(key, cb)
        },
        featuresUpgradedByAffiliation(cb) {
          const key = `features-updated-by=${institutionId}`
          clear(key, cb)
        },
        redundantPersonalSubscription(cb) {
          const key = `redundant-personal-subscription-${institutionId}`
          clear(key, cb)
        },
      },
      callback
    )
  },

  refreshInstitutionUsers(institutionId, notify, callback) {
    const refreshFunction = notify ? refreshFeaturesAndNotify : refreshFeatures
    async.waterfall(
      [
        cb => fetchInstitutionAndAffiliations(institutionId, cb),
        function (institution, affiliations, cb) {
          for (const affiliation of affiliations) {
            affiliation.institutionName = institution.name
            affiliation.institutionId = institutionId
          }
          async.eachLimit(affiliations, ASYNC_LIMIT, refreshFunction, err =>
            cb(err)
          )
        },
      ],
      callback
    )
  },

  checkInstitutionUsers: callbackify(checkInstitutionUsers),

  getInstitutionUsersSubscriptions(institutionId, callback) {
    getInstitutionAffiliations(institutionId, function (error, affiliations) {
      if (error) {
        return callback(error)
      }
      const userIds = affiliations.map(affiliation =>
        ObjectId(affiliation.user_id)
      )
      Subscription.find({ admin_id: userIds })
        .populate('admin_id', 'email')
        .exec(callback)
    })
  },
}

const fetchInstitutionAndAffiliations = (institutionId, callback) =>
  async.waterfall(
    [
      cb =>
        Institution.findOne({ v1Id: institutionId }, (err, institution) =>
          cb(err, institution)
        ),
      (institution, cb) =>
        institution.fetchV1Data((err, institution) => cb(err, institution)),
      (institution, cb) =>
        getConfirmedInstitutionAffiliations(
          institutionId,
          (err, affiliations) => cb(err, institution, affiliations)
        ),
    ],
    callback
  )

function refreshFeatures(affiliation, callback) {
  const userId = ObjectId(affiliation.user_id)
  FeaturesUpdater.refreshFeatures(userId, 'refresh-institution-users', callback)
}

function refreshFeaturesAndNotify(affiliation, callback) {
  const userId = ObjectId(affiliation.user_id)
  async.waterfall(
    [
      cb =>
        FeaturesUpdater.refreshFeatures(
          userId,
          'refresh-institution-users',
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

const getUserInfo = (userId, callback) =>
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

const notifyUser = (
  user,
  affiliation,
  subscription,
  featuresChanged,
  callback
) =>
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
        if (subscription && !subscription.groupPlan) {
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

async function fetchV1Data(institution) {
  const url = `${Settings.apis.v1.url}/universities/list/${institution.v1Id}`
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(Settings.apis.v1.timeout),
    })
    const data = await response.json()

    institution.name = data?.name
    institution.countryCode = data?.country_code
    institution.departments = data?.departments
    institution.portalSlug = data?.portal_slug
  } catch (error) {
    logger.err(
      { model: 'Institution', v1Id: institution.v1Id, error },
      '[fetchV1DataError]'
    )
  }
}

InstitutionsManager.promises = {
  checkInstitutionUsers,
  clearInstitutionNotifications: promisify(
    InstitutionsManager.clearInstitutionNotifications
  ),
  fetchV1Data,
}

module.exports = InstitutionsManager

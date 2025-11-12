import { callbackifyAll, promiseMapWithLimit } from '@overleaf/promise-utils'
import mongodb from 'mongodb-legacy'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import { fetchJson } from '@overleaf/fetch-utils'
import InstitutionsAPI from './InstitutionsAPI.mjs'
import FeaturesUpdater from '../Subscription/FeaturesUpdater.mjs'
import FeaturesHelper from '../Subscription/FeaturesHelper.mjs'
import UserGetter from '../User/UserGetter.mjs'
import NotificationsBuilder from '../Notifications/NotificationsBuilder.mjs'
import NotificationsHandler from '../Notifications/NotificationsHandler.mjs'
import SubscriptionLocator from '../Subscription/SubscriptionLocator.mjs'
import { Institution } from '../../models/Institution.mjs'
import { Subscription } from '../../models/Subscription.mjs'
import OError from '@overleaf/o-error'

const { ObjectId } = mongodb

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

const InstitutionsManager = {
  async clearInstitutionNotifications(institutionId, dryRun) {
    async function clear(key) {
      const run = dryRun
        ? NotificationsHandler.promises.previewMarkAsReadByKeyOnlyBulk
        : NotificationsHandler.promises.markAsReadByKeyOnlyBulk

      return await run(key)
    }

    const ipMatcherAffiliation = await clear(
      `ip-matched-affiliation-${institutionId}`
    )
    const featuresUpgradedByAffiliation = await clear(
      `features-updated-by=${institutionId}`
    )
    const redundantPersonalSubscription = await clear(
      `redundant-personal-subscription-${institutionId}`
    )

    return {
      ipMatcherAffiliation,
      featuresUpgradedByAffiliation,
      redundantPersonalSubscription,
    }
  },

  async refreshInstitutionUsers(institutionId, notify) {
    const refreshFunction = notify ? refreshFeaturesAndNotify : refreshFeatures

    const { institution, affiliations } =
      await fetchInstitutionAndAffiliations(institutionId)

    for (const affiliation of affiliations) {
      affiliation.institutionName = institution.name
      affiliation.institutionId = institutionId
    }

    await promiseMapWithLimit(ASYNC_LIMIT, affiliations, refreshFunction)
  },

  async checkInstitutionUsers(institutionId, emitNonProUserIds) {
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
    } = await InstitutionsAPI.promises.getInstitutionAffiliationsCounts(
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
  },

  async getInstitutionUsersSubscriptions(institutionId) {
    const affiliations =
      await InstitutionsAPI.promises.getInstitutionAffiliations(institutionId)

    const userIds = affiliations.map(
      affiliation => new ObjectId(affiliation.user_id)
    )
    return await Subscription.find({ admin_id: userIds })
      .populate('admin_id', 'email')
      .exec()
  },

  async affiliateUsers(hostname) {
    const reversedHostname = hostname.trim().split('').reverse().join('')

    let users
    try {
      users = await UserGetter.promises.getInstitutionUsersByHostname(hostname)
    } catch (error) {
      OError.tag(error, 'problem fetching users by hostname')
      throw error
    }

    await promiseMapWithLimit(ASYNC_LIMIT, users, user =>
      affiliateUserByReversedHostname(user, reversedHostname)
    )
  },

  async fetchV1Data(institution) {
    const url = `${Settings.apis.v1.url}/universities/list/${institution.v1Id}`
    try {
      const data = await fetchJson(url, {
        signal: AbortSignal.timeout(Settings.apis.v1.timeout),
      })

      institution.name = data?.name
      institution.countryCode = data?.country_code
      institution.departments = data?.departments
      institution.portalSlug = data?.portal_slug
      institution.enterpriseCommons = data?.enterprise_commons
    } catch (error) {
      logger.err(
        { model: 'Institution', v1Id: institution.v1Id, error },
        '[fetchV1DataError]'
      )
    }
  },
}

const fetchInstitutionAndAffiliations = async institutionId => {
  let institution = await Institution.findOne({ v1Id: institutionId }).exec()
  institution = await institution.fetchV1DataPromise()

  const affiliations =
    await InstitutionsAPI.promises.getConfirmedInstitutionAffiliations(
      institutionId
    )

  return { institution, affiliations }
}

async function refreshFeatures(affiliation) {
  const userId = new ObjectId(affiliation.user_id)
  return await FeaturesUpdater.promises.refreshFeatures(
    userId,
    'refresh-institution-users'
  )
}

async function refreshFeaturesAndNotify(affiliation) {
  const userId = new ObjectId(affiliation.user_id)
  const { featuresChanged } = await FeaturesUpdater.promises.refreshFeatures(
    userId,
    'refresh-institution-users'
  )
  const { user, subscription } = await getUserInfo(userId)
  return await notifyUser(user, affiliation, subscription, featuresChanged)
}

const getUserInfo = async userId => {
  const user = await UserGetter.promises.getUser(userId, { _id: 1 })
  const subscription =
    await SubscriptionLocator.promises.getUsersSubscription(user)
  return { user, subscription }
}

const notifyUser = async (user, affiliation, subscription, featuresChanged) => {
  return await Promise.all([
    (async () => {
      if (featuresChanged) {
        return await NotificationsBuilder.promises
          .featuresUpgradedByAffiliation(affiliation, user)
          .create()
      }
    })(),
    (async () => {
      if (subscription && !subscription.groupPlan) {
        return await NotificationsBuilder.promises
          .redundantPersonalSubscription(affiliation, user)
          .create()
      }
    })(),
  ])
}

async function affiliateUserByReversedHostname(user, reversedHostname) {
  const matchingEmails = user.emails.filter(
    email => email.reversedHostname === reversedHostname
  )

  for (const email of matchingEmails) {
    try {
      await InstitutionsAPI.promises.addAffiliation(user._id, email.email, {
        confirmedAt: email.confirmedAt,
        entitlement:
          email.samlIdentifier && email.samlIdentifier.hasEntitlement,
      })
    } catch (error) {
      OError.tag(error, 'problem adding affiliation while confirming hostname')
      throw error
    }
  }

  await FeaturesUpdater.promises.refreshFeatures(
    user._id,
    'affiliate-user-by-reversed-hostname'
  )
}

export default {
  ...callbackifyAll(InstitutionsManager),
  promises: InstitutionsManager,
}

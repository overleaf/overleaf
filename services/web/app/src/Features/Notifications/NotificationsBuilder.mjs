import NotificationsHandler from './NotificationsHandler.mjs'
import { callbackifyAll } from '@overleaf/promise-utils'
import { fetchJson } from '@overleaf/fetch-utils'
import settings from '@overleaf/settings'
import path from 'node:path'
import mongodb from 'mongodb-legacy'

const { ObjectId } = mongodb

function dropboxDuplicateProjectNames(userId) {
  return {
    key: `dropboxDuplicateProjectNames-${userId}`,
    async create(projectName) {
      return await NotificationsHandler.promises.createNotification(
        userId,
        this.key,
        'notification_dropbox_duplicate_project_names',
        { projectName },
        null,
        true
      )
    },
    async read() {
      return await NotificationsHandler.promises.markAsReadWithKey(
        userId,
        this.key
      )
    },
  }
}

function dropboxUnlinkedDueToLapsedReconfirmation(userId) {
  return {
    key: 'drobox-unlinked-due-to-lapsed-reconfirmation',
    async create() {
      return await NotificationsHandler.promises.createNotification(
        userId,
        this.key,
        'notification_dropbox_unlinked_due_to_lapsed_reconfirmation',
        {},
        null,
        true
      )
    },
    async read() {
      return await NotificationsHandler.promises.markAsReadWithKey(
        userId,
        this.key
      )
    },
  }
}

function featuresUpgradedByAffiliation(affiliation, user) {
  return {
    key: `features-updated-by=${affiliation.institutionId}`,
    async create() {
      const messageOpts = { institutionName: affiliation.institutionName }
      return await NotificationsHandler.promises.createNotification(
        user._id.toString(),
        this.key,
        'notification_features_upgraded_by_affiliation',
        messageOpts,
        null,
        false
      )
    },
    async read() {
      return await NotificationsHandler.promises.markAsReadWithKey(
        user._id,
        this.key
      )
    },
  }
}

function redundantPersonalSubscription(affiliation, user) {
  return {
    key: `redundant-personal-subscription-${affiliation.institutionId}`,
    async create() {
      const messageOpts = { institutionName: affiliation.institutionName }
      return await NotificationsHandler.promises.createNotification(
        user._id.toString(),
        this.key,
        'notification_personal_subscription_not_required_due_to_affiliation',
        messageOpts,
        null,
        false
      )
    },
    async read() {
      return await NotificationsHandler.promises.markAsReadWithKey(
        user._id,
        this.key
      )
    },
  }
}

function projectInvite(invite, project, sendingUser, user) {
  return {
    key: `project-invite-${invite._id}`,
    async create() {
      const messageOpts = {
        userName: sendingUser.first_name,
        projectName: project.name,
        projectId: project._id.toString(),
        token: invite.token,
      }
      return await NotificationsHandler.promises.createNotification(
        user._id.toString(),
        this.key,
        'notification_project_invite',
        messageOpts,
        invite.expires
      )
    },
    async read() {
      return await NotificationsHandler.promises.markAsReadByKeyOnly(this.key)
    },
  }
}

function ipMatcherAffiliation(userId) {
  return {
    async create(ip) {
      if (!settings.apis.v1.url) {
        // service is not configured
        return
      }
      if (!ObjectId.isValid(userId)) {
        throw new Error('invalid user id')
      }
      const url = new URL(settings.apis.v1.url)
      url.pathname = path.posix.join('/api/v2/users', userId, 'ip_matcher')
      url.searchParams.set('ip', ip)

      const body = await fetchJson(url, {
        method: 'GET',
        basicAuth: {
          user: settings.apis.v1.user,
          password: settings.apis.v1.pass,
        },
        signal: AbortSignal.timeout(settings.apis.v1.timeout || 10_000),
      })
      if (!body) return

      const key = `ip-matched-affiliation-${body.id}`
      const portalPath = body.portal_slug
        ? `/${body.is_university ? 'edu' : 'org'}/${body.portal_slug}`
        : undefined
      const messageOpts = {
        university_name: body.name,
        institutionId: body.id,
        portalPath,
        ssoEnabled: body.sso_enabled,
      }
      return await NotificationsHandler.promises.createNotification(
        userId,
        key,
        'notification_ip_matched_affiliation',
        messageOpts,
        null,
        false
      )
    },

    async read(universityId) {
      const key = `ip-matched-affiliation-${universityId}`
      return await NotificationsHandler.promises.markAsReadWithKey(userId, key)
    },
  }
}

function tpdsFileLimit(userId) {
  return {
    key: `tpdsFileLimit-${userId}`,
    async create(projectName, projectId) {
      const messageOpts = {
        projectName,
        projectId,
      }
      return await NotificationsHandler.promises.createNotification(
        userId,
        this.key,
        'notification_tpds_file_limit',
        messageOpts,
        null,
        true
      )
    },
    async read() {
      return await NotificationsHandler.promises.markAsReadByKeyOnly(this.key)
    },
  }
}

function groupInvitation(userId, subscriptionId, managedUsersEnabled) {
  return {
    key: `groupInvitation-${subscriptionId}-${userId}`,
    async create(invite) {
      const messageOpts = {
        token: invite.token,
        inviterName: invite.inviterName,
        managedUsersEnabled,
      }
      return await NotificationsHandler.promises.createNotification(
        userId,
        this.key,
        'notification_group_invitation',
        messageOpts,
        null,
        true
      )
    },
    async read() {
      return await NotificationsHandler.promises.markAsReadByKeyOnly(this.key)
    },
  }
}

function personalAndGroupSubscriptions(userId) {
  return {
    key: 'personal-and-group-subscriptions',
    async create() {
      return await NotificationsHandler.promises.createNotification(
        userId,
        this.key,
        'notification_personal_and_group_subscriptions',
        {},
        null,
        false
      )
    },
    async read() {
      return await NotificationsHandler.promises.markAsReadByKeyOnly(this.key)
    },
  }
}

const NotificationsBuilder = {
  // Note: notification keys should be url-safe
  dropboxUnlinkedDueToLapsedReconfirmation(userId) {
    return callbackifyAll(dropboxUnlinkedDueToLapsedReconfirmation(userId))
  },
  dropboxDuplicateProjectNames(userId) {
    return callbackifyAll(dropboxDuplicateProjectNames(userId))
  },
  featuresUpgradedByAffiliation(affiliation, user) {
    return callbackifyAll(featuresUpgradedByAffiliation(affiliation, user))
  },
  redundantPersonalSubscription(affiliation, user) {
    return callbackifyAll(redundantPersonalSubscription(affiliation, user))
  },
  projectInvite(invite, project, sendingUser, user) {
    return callbackifyAll(projectInvite(invite, project, sendingUser, user))
  },
  ipMatcherAffiliation(userId) {
    return callbackifyAll(ipMatcherAffiliation(userId))
  },
  tpdsFileLimit(userId) {
    return callbackifyAll(tpdsFileLimit(userId))
  },
  groupInvitation(userId, groupId, managedUsersEnabled) {
    return callbackifyAll(groupInvitation(userId, groupId, managedUsersEnabled))
  },
  personalAndGroupSubscriptions(userId) {
    return callbackifyAll(personalAndGroupSubscriptions(userId))
  },
}

NotificationsBuilder.promises = {
  dropboxUnlinkedDueToLapsedReconfirmation,
  redundantPersonalSubscription,
  dropboxDuplicateProjectNames,
  featuresUpgradedByAffiliation,
  ipMatcherAffiliation,
  groupInvitation,
  projectInvite,
  personalAndGroupSubscriptions,
  tpdsFileLimit,
}

export default NotificationsBuilder

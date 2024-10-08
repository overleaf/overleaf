const NotificationsHandler = require('./NotificationsHandler')
const { promisifyAll } = require('@overleaf/promise-utils')
const request = require('request')
const settings = require('@overleaf/settings')

function dropboxDuplicateProjectNames(userId) {
  return {
    key: `dropboxDuplicateProjectNames-${userId}`,
    create(projectName, callback) {
      if (callback == null) {
        callback = function () {}
      }
      NotificationsHandler.createNotification(
        userId,
        this.key,
        'notification_dropbox_duplicate_project_names',
        { projectName },
        null,
        true,
        callback
      )
    },
    read(callback) {
      if (callback == null) {
        callback = function () {}
      }
      NotificationsHandler.markAsReadWithKey(userId, this.key, callback)
    },
  }
}

function dropboxUnlinkedDueToLapsedReconfirmation(userId) {
  return {
    key: 'drobox-unlinked-due-to-lapsed-reconfirmation',
    create(callback) {
      NotificationsHandler.createNotification(
        userId,
        this.key,
        'notification_dropbox_unlinked_due_to_lapsed_reconfirmation',
        {},
        null,
        true,
        callback
      )
    },
    read(callback) {
      NotificationsHandler.markAsReadWithKey(userId, this.key, callback)
    },
  }
}

function featuresUpgradedByAffiliation(affiliation, user) {
  return {
    key: `features-updated-by=${affiliation.institutionId}`,
    create(callback) {
      if (callback == null) {
        callback = function () {}
      }
      const messageOpts = { institutionName: affiliation.institutionName }
      NotificationsHandler.createNotification(
        user._id,
        this.key,
        'notification_features_upgraded_by_affiliation',
        messageOpts,
        null,
        false,
        callback
      )
    },
    read(callback) {
      if (callback == null) {
        callback = function () {}
      }
      NotificationsHandler.markAsReadWithKey(user._id, this.key, callback)
    },
  }
}

function redundantPersonalSubscription(affiliation, user) {
  return {
    key: `redundant-personal-subscription-${affiliation.institutionId}`,
    create(callback) {
      if (callback == null) {
        callback = function () {}
      }
      const messageOpts = { institutionName: affiliation.institutionName }
      NotificationsHandler.createNotification(
        user._id,
        this.key,
        'notification_personal_subscription_not_required_due_to_affiliation',
        messageOpts,
        null,
        false,
        callback
      )
    },
    read(callback) {
      if (callback == null) {
        callback = function () {}
      }
      NotificationsHandler.markAsReadWithKey(user._id, this.key, callback)
    },
  }
}

function projectInvite(invite, project, sendingUser, user) {
  return {
    key: `project-invite-${invite._id}`,
    create(callback) {
      if (callback == null) {
        callback = function () {}
      }
      const messageOpts = {
        userName: sendingUser.first_name,
        projectName: project.name,
        projectId: project._id.toString(),
        token: invite.token,
      }
      NotificationsHandler.createNotification(
        user._id,
        this.key,
        'notification_project_invite',
        messageOpts,
        invite.expires,
        callback
      )
    },
    read(callback) {
      if (callback == null) {
        callback = function () {}
      }
      NotificationsHandler.markAsReadByKeyOnly(this.key, callback)
    },
  }
}

function ipMatcherAffiliation(userId) {
  return {
    create(ip, callback) {
      if (callback == null) {
        callback = function () {}
      }
      if (!settings.apis.v1.url) {
        // service is not configured
        return callback()
      }
      request(
        {
          method: 'GET',
          url: `${settings.apis.v1.url}/api/v2/users/${userId}/ip_matcher`,
          auth: { user: settings.apis.v1.user, pass: settings.apis.v1.pass },
          body: { ip },
          json: true,
          timeout: settings.apis.v1.timeout,
        },
        function (error, response, body) {
          if (error != null) {
            return callback(error)
          }
          if (response.statusCode !== 200) {
            return callback()
          }

          const key = `ip-matched-affiliation-${body.id}`
          const portalPath = body.portal_slug
            ? `/${body.is_university ? 'edu' : 'org'}/${body.portal_slug}`
            : undefined
          const messageOpts = {
            university_name: body.name,
            institutionId: body.id,
            content: body.enrolment_ad_html,
            portalPath,
            ssoEnabled: body.sso_enabled,
          }
          NotificationsHandler.createNotification(
            userId,
            key,
            'notification_ip_matched_affiliation',
            messageOpts,
            null,
            false,
            callback
          )
        }
      )
    },

    read(universityId, callback) {
      if (callback == null) {
        callback = function () {}
      }
      const key = `ip-matched-affiliation-${universityId}`
      NotificationsHandler.markAsReadWithKey(userId, key, callback)
    },
  }
}

function tpdsFileLimit(userId) {
  return {
    key: `tpdsFileLimit-${userId}`,
    create(projectName, projectId, callback) {
      if (callback == null) {
        callback = function () {}
      }
      const messageOpts = {
        projectName,
        projectId,
      }
      NotificationsHandler.createNotification(
        userId,
        this.key,
        'notification_tpds_file_limit',
        messageOpts,
        null,
        true,
        callback
      )
    },
    read(callback) {
      if (callback == null) {
        callback = function () {}
      }
      NotificationsHandler.markAsReadByKeyOnly(this.key, callback)
    },
  }
}

function groupInvitation(userId, subscriptionId, managedUsersEnabled) {
  return {
    key: `groupInvitation-${subscriptionId}-${userId}`,
    create(invite, callback) {
      if (callback == null) {
        callback = function () {}
      }
      const messageOpts = {
        token: invite.token,
        inviterName: invite.inviterName,
        managedUsersEnabled,
      }
      NotificationsHandler.createNotification(
        userId,
        this.key,
        'notification_group_invitation',
        messageOpts,
        null,
        true,
        callback
      )
    },
    read(callback) {
      if (callback == null) {
        callback = function () {}
      }
      NotificationsHandler.markAsReadByKeyOnly(this.key, callback)
    },
  }
}

function personalAndGroupSubscriptions(userId) {
  return {
    key: 'personal-and-group-subscriptions',
    create(callback) {
      if (callback == null) {
        callback = function () {}
      }
      NotificationsHandler.createNotification(
        userId,
        this.key,
        'notification_personal_and_group_subscriptions',
        {},
        null,
        false,
        callback
      )
    },
    read(callback) {
      if (callback == null) {
        callback = function () {}
      }
      NotificationsHandler.markAsReadByKeyOnly(this.key, callback)
    },
  }
}

const NotificationsBuilder = {
  // Note: notification keys should be url-safe
  dropboxUnlinkedDueToLapsedReconfirmation,
  dropboxDuplicateProjectNames,
  featuresUpgradedByAffiliation,
  redundantPersonalSubscription,
  projectInvite,
  ipMatcherAffiliation,
  tpdsFileLimit,
  groupInvitation,
  personalAndGroupSubscriptions,
}

NotificationsBuilder.promises = {
  dropboxUnlinkedDueToLapsedReconfirmation: function (userId) {
    return promisifyAll(dropboxUnlinkedDueToLapsedReconfirmation(userId))
  },
  redundantPersonalSubscription: function (affiliation, user) {
    return promisifyAll(redundantPersonalSubscription(affiliation, user))
  },
  dropboxDuplicateProjectNames(userId) {
    return promisifyAll(dropboxDuplicateProjectNames(userId))
  },
  featuresUpgradedByAffiliation: function (affiliation, user) {
    return promisifyAll(featuresUpgradedByAffiliation(affiliation, user))
  },
  ipMatcherAffiliation: function (userId) {
    return promisifyAll(ipMatcherAffiliation(userId))
  },
  groupInvitation: function (userId, groupId, managedUsersEnabled) {
    return promisifyAll(groupInvitation(userId, groupId, managedUsersEnabled))
  },
  projectInvite(invite, project, sendingUser, user) {
    return promisifyAll(projectInvite(invite, project, sendingUser, user))
  },
  personalAndGroupSubscriptions(userId) {
    return promisifyAll(personalAndGroupSubscriptions(userId))
  },
}

module.exports = NotificationsBuilder

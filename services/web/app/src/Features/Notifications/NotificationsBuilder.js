/* eslint-disable
    camelcase,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const NotificationsHandler = require('./NotificationsHandler')
const { promisifyAll } = require('../../util/promises')
const request = require('request')
const settings = require('settings-sharelatex')

function featuresUpgradedByAffiliation(affiliation, user) {
  return {
    key: `features-updated-by=${affiliation.institutionId}`,
    create(callback) {
      if (callback == null) {
        callback = function() {}
      }
      const messageOpts = { institutionName: affiliation.institutionName }
      return NotificationsHandler.createNotification(
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
        callback = function() {}
      }
      return NotificationsHandler.markAsReadByKeyOnly(this.key, callback)
    }
  }
}

function redundantPersonalSubscription(affiliation, user) {
  return {
    key: `redundant-personal-subscription-${affiliation.institutionId}`,
    create(callback) {
      if (callback == null) {
        callback = function() {}
      }
      const messageOpts = { institutionName: affiliation.institutionName }
      return NotificationsHandler.createNotification(
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
        callback = function() {}
      }
      return NotificationsHandler.markAsReadByKeyOnly(this.key, callback)
    }
  }
}

function projectInvite(invite, project, sendingUser, user) {
  return {
    key: `project-invite-${invite._id}`,
    create(callback) {
      if (callback == null) {
        callback = function() {}
      }
      const messageOpts = {
        userName: sendingUser.first_name,
        projectName: project.name,
        projectId: project._id.toString(),
        token: invite.token
      }
      return NotificationsHandler.createNotification(
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
        callback = function() {}
      }
      return NotificationsHandler.markAsReadByKeyOnly(this.key, callback)
    }
  }
}

function ipMatcherAffiliation(userId) {
  return {
    create(ip, callback) {
      if (callback == null) {
        callback = function() {}
      }
      if (!settings.apis.v1.url) {
        return null
      } // service is not configured
      return request(
        {
          method: 'GET',
          url: `${settings.apis.v1.url}/api/v2/users/${userId}/ip_matcher`,
          auth: { user: settings.apis.v1.user, pass: settings.apis.v1.pass },
          body: { ip },
          json: true,
          timeout: 20 * 1000
        },
        function(error, response, body) {
          if (error != null) {
            return error
          }
          if (response.statusCode !== 200) {
            return null
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
            ssoEnabled: body.sso_enabled
          }
          return NotificationsHandler.createNotification(
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

    read(university_id, callback) {
      if (callback == null) {
        callback = function() {}
      }
      const key = `ip-matched-affiliation-${university_id}`
      return NotificationsHandler.markAsReadWithKey(userId, key, callback)
    }
  }
}

function tpdsFileLimit(user_id) {
  return {
    key: `tpdsFileLimit-${user_id}`,
    create(projectName, callback) {
      if (callback == null) {
        callback = function() {}
      }
      const messageOpts = {
        projectName: projectName
      }
      return NotificationsHandler.createNotification(
        user_id,
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
        callback = function() {}
      }
      return NotificationsHandler.markAsReadByKeyOnly(this.key, callback)
    }
  }
}

const NotificationsBuilder = {
  // Note: notification keys should be url-safe

  featuresUpgradedByAffiliation,

  redundantPersonalSubscription,

  projectInvite,

  ipMatcherAffiliation,

  tpdsFileLimit
}

NotificationsBuilder.promises = {
  redundantPersonalSubscription: function(affiliation, user) {
    return promisifyAll(redundantPersonalSubscription(affiliation, user))
  }
}

module.exports = NotificationsBuilder

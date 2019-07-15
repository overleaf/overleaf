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
const logger = require('logger-sharelatex')
const NotificationsHandler = require('./NotificationsHandler')
const request = require('request')
const settings = require('settings-sharelatex')

module.exports = {
  // Note: notification keys should be url-safe

  featuresUpgradedByAffiliation(affiliation, user) {
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
        return NotificationsHandler.markAsRead(this.key, callback)
      }
    }
  },

  redundantPersonalSubscription(affiliation, user) {
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
        return NotificationsHandler.markAsRead(this.key, callback)
      }
    }
  },

  projectInvite(invite, project, sendingUser, user) {
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
        logger.log(
          {
            user_id: user._id,
            project_id: project._id,
            invite_id: invite._id,
            key: this.key
          },
          'creating project invite notification for user'
        )
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
  },

  ipMatcherAffiliation(userId) {
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
            const messageOpts = {
              university_name: body.name,
              content: body.enrolment_ad_html
            }
            logger.log(
              { user_id: userId, key },
              'creating notification key for user'
            )
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
}

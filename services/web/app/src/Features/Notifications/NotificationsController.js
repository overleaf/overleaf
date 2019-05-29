/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const NotificationsHandler = require('./NotificationsHandler')
const AuthenticationController = require('../Authentication/AuthenticationController')
const logger = require('logger-sharelatex')
const _ = require('underscore')

module.exports = {
  getAllUnreadNotifications(req, res) {
    const user_id = AuthenticationController.getLoggedInUserId(req)
    return NotificationsHandler.getUserNotifications(user_id, function(
      err,
      unreadNotifications
    ) {
      unreadNotifications = _.map(unreadNotifications, function(notification) {
        notification.html = req.i18n.translate(
          notification.templateKey,
          notification.messageOpts
        )
        return notification
      })
      return res.send(unreadNotifications)
    })
  },

  markNotificationAsRead(req, res) {
    const user_id = AuthenticationController.getLoggedInUserId(req)
    const { notification_id } = req.params
    NotificationsHandler.markAsRead(user_id, notification_id, () => res.send())
    return logger.log({ user_id, notification_id }, 'mark notification as read')
  }
}

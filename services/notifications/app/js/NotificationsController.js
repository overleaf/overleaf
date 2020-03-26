/* eslint-disable
    camelcase,
    handle-callback-err,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Notifications = require('./Notifications')
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')

module.exports = {
  getUserNotifications(req, res) {
    logger.log(
      { user_id: req.params.user_id },
      'getting user unread notifications'
    )
    metrics.inc('getUserNotifications')
    return Notifications.getUserNotifications(
      req.params.user_id,
      (err, notifications) => res.json(notifications)
    )
  },

  addNotification(req, res) {
    logger.log(
      { user_id: req.params.user_id, notification: req.body },
      'adding notification'
    )
    metrics.inc('addNotification')
    return Notifications.addNotification(req.params.user_id, req.body, function(
      err,
      notifications
    ) {
      if (err != null) {
        return res.sendStatus(500)
      } else {
        return res.send()
      }
    })
  },

  removeNotificationId(req, res) {
    logger.log(
      {
        user_id: req.params.user_id,
        notification_id: req.params.notification_id
      },
      'mark id notification as read'
    )
    metrics.inc('removeNotificationId')
    return Notifications.removeNotificationId(
      req.params.user_id,
      req.params.notification_id,
      (err, notifications) => res.send()
    )
  },

  removeNotificationKey(req, res) {
    logger.log(
      { user_id: req.params.user_id, notification_key: req.body.key },
      'mark key notification as read'
    )
    metrics.inc('removeNotificationKey')
    return Notifications.removeNotificationKey(
      req.params.user_id,
      req.body.key,
      (err, notifications) => res.send()
    )
  },

  removeNotificationByKeyOnly(req, res) {
    const notification_key = req.params.key
    logger.log({ notification_key }, 'mark notification as read by key only')
    metrics.inc('removeNotificationKey')
    return Notifications.removeNotificationByKeyOnly(
      notification_key,
      (err, notifications) => res.send()
    )
  }
}

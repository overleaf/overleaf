/* eslint-disable
    camelcase,
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
const metrics = require('@overleaf/metrics')

module.exports = {
  getUserNotifications(req, res, next) {
    logger.log(
      { user_id: req.params.user_id },
      'getting user unread notifications'
    )
    metrics.inc('getUserNotifications')
    return Notifications.getUserNotifications(
      req.params.user_id,
      (err, notifications) => {
        if (err) return next(err)
        res.json(notifications)
      }
    )
  },

  addNotification(req, res) {
    logger.log(
      { user_id: req.params.user_id, notification: req.body },
      'adding notification'
    )
    metrics.inc('addNotification')
    return Notifications.addNotification(
      req.params.user_id,
      req.body,
      function (err, notifications) {
        if (err != null) {
          return res.sendStatus(500)
        } else {
          return res.sendStatus(200)
        }
      }
    )
  },

  removeNotificationId(req, res, next) {
    logger.log(
      {
        user_id: req.params.user_id,
        notification_id: req.params.notification_id,
      },
      'mark id notification as read'
    )
    metrics.inc('removeNotificationId')
    return Notifications.removeNotificationId(
      req.params.user_id,
      req.params.notification_id,
      err => {
        if (err) return next(err)
        res.sendStatus(200)
      }
    )
  },

  removeNotificationKey(req, res, next) {
    logger.log(
      { user_id: req.params.user_id, notification_key: req.body.key },
      'mark key notification as read'
    )
    metrics.inc('removeNotificationKey')
    return Notifications.removeNotificationKey(
      req.params.user_id,
      req.body.key,
      (err, notifications) => {
        if (err) return next(err)
        res.sendStatus(200)
      }
    )
  },

  removeNotificationByKeyOnly(req, res, next) {
    const notification_key = req.params.key
    logger.log({ notification_key }, 'mark notification as read by key only')
    metrics.inc('removeNotificationKey')
    return Notifications.removeNotificationByKeyOnly(notification_key, err => {
      if (err) return next(err)
      res.sendStatus(200)
    })
  },

  countNotificationsByKeyOnly(req, res) {
    const notificationKey = req.params.key
    Notifications.countNotificationsByKeyOnly(notificationKey, (err, count) => {
      if (err) {
        logger.err({ err, notificationKey }, 'cannot count by key')
        return res.sendStatus(500)
      }
      res.json({ count })
    })
  },

  deleteUnreadNotificationsByKeyOnlyBulk(req, res) {
    const notificationKey = req.params.key
    Notifications.deleteUnreadNotificationsByKeyOnlyBulk(
      notificationKey,
      (err, count) => {
        if (err) {
          logger.err({ err, notificationKey }, 'cannot bulk remove by key')
          return res.sendStatus(500)
        }
        res.json({ count })
      }
    )
  },
}

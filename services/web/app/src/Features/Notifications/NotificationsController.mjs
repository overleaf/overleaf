import NotificationsHandler from './NotificationsHandler.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import _ from 'lodash'

export default {
  getAllUnreadNotifications(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    NotificationsHandler.getUserNotifications(
      userId,
      function (err, unreadNotifications) {
        if (err) {
          return next(err)
        }
        unreadNotifications = _.map(
          unreadNotifications,
          function (notification) {
            notification.html = req.i18n.translate(
              notification.templateKey,
              notification.messageOpts
            )
            return notification
          }
        )
        res.json(unreadNotifications)
      }
    )
  },

  markNotificationAsRead(req, res) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const { notificationId } = req.params
    NotificationsHandler.markAsRead(userId, notificationId, () =>
      res.sendStatus(200)
    )
  },

  getNotification(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const { notificationId } = req.params
    NotificationsHandler.getUserNotifications(
      userId,
      function (err, unreadNotifications) {
        if (err) {
          return next(err)
        }
        const notification = unreadNotifications.find(
          n => n._id === notificationId
        )

        if (!notification) {
          return res.status(404).end()
        }

        res.json(notification)
      }
    )
  },
}

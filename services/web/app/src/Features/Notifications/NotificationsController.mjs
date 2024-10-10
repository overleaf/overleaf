import NotificationsHandler from './NotificationsHandler.js'
import SessionManager from '../Authentication/SessionManager.js'
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
}

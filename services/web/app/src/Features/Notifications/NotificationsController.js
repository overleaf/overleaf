const NotificationsHandler = require('./NotificationsHandler')
const SessionManager = require('../Authentication/SessionManager')
const _ = require('underscore')

module.exports = {
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
        res.send(unreadNotifications)
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

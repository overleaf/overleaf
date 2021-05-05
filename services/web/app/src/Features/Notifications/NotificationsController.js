const NotificationsHandler = require('./NotificationsHandler')
const AuthenticationController = require('../Authentication/AuthenticationController')
const _ = require('underscore')

module.exports = {
  getAllUnreadNotifications(req, res) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    NotificationsHandler.getUserNotifications(
      userId,
      function (err, unreadNotifications) {
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
    const userId = AuthenticationController.getLoggedInUserId(req)
    const { notificationId } = req.params
    NotificationsHandler.markAsRead(userId, notificationId, () =>
      res.sendStatus(200)
    )
  },
}

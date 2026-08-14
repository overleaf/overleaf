import NotificationsHandler from './NotificationsHandler.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import _ from 'lodash'
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'

const notificationIdParamsSchema = z.object({
  params: z.strictObject({
    notificationId: zz.objectId(),
  }),
})

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
    const { params } = parseReq(req, notificationIdParamsSchema, {
      logOnly: true,
    })
    const { notificationId } = params
    NotificationsHandler.markAsRead(userId, notificationId, () =>
      res.sendStatus(200)
    )
  },

  getNotification(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const { params } = parseReq(req, notificationIdParamsSchema, {
      logOnly: true,
    })
    const { notificationId } = params
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

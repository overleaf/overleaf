import logger from '@overleaf/logger'
import metrics from '@overleaf/metrics'
import Notifications from './Notifications.js'
import { expressify } from '@overleaf/promise-utils'

async function getUserNotifications(req, res, next) {
  logger.debug(
    { userId: req.params.user_id },
    'getting user unread notifications'
  )
  metrics.inc('getUserNotifications')
  const notifications = await Notifications.getUserNotifications(
    req.params.user_id
  )
  res.json(notifications)
}

async function addNotification(req, res) {
  logger.debug(
    { userId: req.params.user_id, notification: req.body },
    'adding notification'
  )
  metrics.inc('addNotification')
  try {
    await Notifications.addNotification(req.params.user_id, req.body)
    res.sendStatus(200)
  } catch (err) {
    res.sendStatus(500)
  }
}

async function removeNotificationId(req, res) {
  logger.debug(
    {
      userId: req.params.user_id,
      notificationId: req.params.notification_id,
    },
    'mark id notification as read'
  )
  metrics.inc('removeNotificationId')
  await Notifications.removeNotificationId(
    req.params.user_id,
    req.params.notification_id
  )
  res.sendStatus(200)
}

async function removeNotificationKey(req, res) {
  logger.debug(
    { userId: req.params.user_id, notificationKey: req.body.key },
    'mark key notification as read'
  )
  metrics.inc('removeNotificationKey')
  await Notifications.removeNotificationKey(req.params.user_id, req.body.key)

  res.sendStatus(200)
}

async function removeNotificationByKeyOnly(req, res) {
  const notificationKey = req.params.key
  logger.debug({ notificationKey }, 'mark notification as read by key only')
  metrics.inc('removeNotificationKey')
  await Notifications.removeNotificationByKeyOnly(notificationKey)
  res.sendStatus(200)
}

async function countNotificationsByKeyOnly(req, res) {
  const notificationKey = req.params.key
  try {
    const count =
      await Notifications.countNotificationsByKeyOnly(notificationKey)
    res.json({ count })
  } catch (err) {
    logger.err({ err, notificationKey }, 'cannot count by key')
    res.sendStatus(500)
  }
}

async function deleteUnreadNotificationsByKeyOnlyBulk(req, res) {
  const notificationKey = req.params.key
  try {
    const count =
      await Notifications.deleteUnreadNotificationsByKeyOnlyBulk(
        notificationKey
      )
    res.json({ count })
  } catch (err) {
    logger.err({ err, notificationKey }, 'cannot bulk remove by key')
    res.sendStatus(500)
  }
}

export default {
  getUserNotifications: expressify(getUserNotifications),
  addNotification: expressify(addNotification),
  deleteUnreadNotificationsByKeyOnlyBulk: expressify(
    deleteUnreadNotificationsByKeyOnlyBulk
  ),
  removeNotificationByKeyOnly: expressify(removeNotificationByKeyOnly),
  removeNotificationId: expressify(removeNotificationId),
  removeNotificationKey: expressify(removeNotificationKey),
  countNotificationsByKeyOnly: expressify(countNotificationsByKeyOnly),
}

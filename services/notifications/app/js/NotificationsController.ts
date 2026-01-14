import logger from '@overleaf/logger'
import metrics from '@overleaf/metrics'
import Notifications from './Notifications.js'
import { expressify } from '@overleaf/promise-utils'
import { parseReq, z, zz } from '@overleaf/validation-tools'
import type { Request, Response } from 'express'

const getUserNotificationsSchema = z.object({
  params: z.object({
    user_id: zz.objectId(),
  }),
})

async function getUserNotifications(req: Request, res: Response) {
  const { params } = parseReq(req, getUserNotificationsSchema)
  logger.debug({ userId: params.user_id }, 'getting user unread notifications')
  metrics.inc('getUserNotifications')
  const notifications = await Notifications.getUserNotifications(params.user_id)
  res.json(notifications)
}

const addNotificationSchema = z.object({
  params: z.object({
    user_id: zz.objectId(),
  }),
  body: z.looseObject({}),
})

async function addNotification(req: Request, res: Response) {
  const { params, body } = parseReq(req, addNotificationSchema)
  logger.debug(
    { userId: params.user_id, notification: body },
    'adding notification'
  )
  metrics.inc('addNotification')
  try {
    await Notifications.addNotification(params.user_id, body)
    res.sendStatus(200)
  } catch (err) {
    res.sendStatus(500)
  }
}

const removeNotificationIdSchema = z.object({
  params: z.object({
    user_id: zz.objectId(),
    notification_id: zz.objectId(),
  }),
})

async function removeNotificationId(req: Request, res: Response) {
  const { params } = parseReq(req, removeNotificationIdSchema)
  logger.debug(
    {
      userId: req.params.user_id,
      notificationId: req.params.notification_id,
    },
    'mark id notification as read'
  )
  metrics.inc('removeNotificationId')
  await Notifications.removeNotificationId(
    params.user_id,
    params.notification_id
  )
  res.sendStatus(200)
}

const removeNotificationKeySchema = z.object({
  params: z.object({
    user_id: zz.objectId(),
  }),
  body: z.object({
    key: z.string(),
  }),
})

async function removeNotificationKey(req: Request, res: Response) {
  const { params, body } = parseReq(req, removeNotificationKeySchema)
  logger.debug(
    { userId: req.params.user_id, notificationKey: body.key },
    'mark key notification as read'
  )
  metrics.inc('removeNotificationKey')
  await Notifications.removeNotificationKey(params.user_id, body.key)

  res.sendStatus(200)
}

const removeNotificationByKeyOnlySchema = z.object({
  params: z.object({
    key: z.string(),
  }),
})

async function removeNotificationByKeyOnly(req: Request, res: Response) {
  const { params } = parseReq(req, removeNotificationByKeyOnlySchema)
  const notificationKey = params.key
  logger.debug({ notificationKey }, 'mark notification as read by key only')
  metrics.inc('removeNotificationKey')
  await Notifications.removeNotificationByKeyOnly(notificationKey)
  res.sendStatus(200)
}

const countNotificationsByKeyOnlySchema = z.object({
  params: z.object({
    key: z.string(),
  }),
})

async function countNotificationsByKeyOnly(req: Request, res: Response) {
  const { params } = parseReq(req, countNotificationsByKeyOnlySchema)
  const notificationKey = params.key
  try {
    const count =
      await Notifications.countNotificationsByKeyOnly(notificationKey)
    res.json({ count })
  } catch (err) {
    logger.err({ err, notificationKey }, 'cannot count by key')
    res.sendStatus(500)
  }
}

const deleteUnreadNotificationsByKeyOnlyBulkSchema = z.object({
  params: z.object({
    key: z.string(),
  }),
})

async function deleteUnreadNotificationsByKeyOnlyBulk(
  req: Request,
  res: Response
) {
  const { params } = parseReq(req, deleteUnreadNotificationsByKeyOnlyBulkSchema)
  const notificationKey = params.key
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

import logger from '@overleaf/logger'
import { db, ObjectId } from './mongodb.js'

async function getUserNotifications(userId) {
  const query = {
    user_id: new ObjectId(userId),
    templateKey: { $exists: true },
  }
  return await db.notifications.find(query).toArray()
}

async function _countExistingNotifications(userId, notification) {
  const query = {
    user_id: new ObjectId(userId),
    key: notification.key,
  }
  return await db.notifications.count(query)
}

async function addNotification(userId, notification, callback) {
  const count = await _countExistingNotifications(userId, notification)
  if (count !== 0 && !notification.forceCreate) {
    return
  }
  const doc = {
    user_id: new ObjectId(userId),
    key: notification.key,
    messageOpts: notification.messageOpts,
    templateKey: notification.templateKey,
  }
  // TTL index on the optional `expires` field, which should arrive as an iso date-string, corresponding to
  // a datetime in the future when the document should be automatically removed.
  // in Mongo, TTL indexes only work on date fields, and ignore the document when that field is missing
  // see `README.md` for instruction on creating TTL index
  if (notification.expires != null) {
    try {
      doc.expires = new Date(notification.expires)
      // _testValue assignment will throw if `expires` is not a valid date
      // eslint-disable-next-line no-unused-vars
      const _testValue = doc.expires.toISOString()
    } catch (error) {
      logger.error(
        { userId, expires: notification.expires },
        'error converting `expires` field to Date'
      )
      throw error
    }
  }
  return await db.notifications.updateOne(
    { user_id: doc.user_id, key: notification.key },
    { $set: doc },
    { upsert: true }
  )
}

async function removeNotificationId(userId, notificationId) {
  const searchOps = {
    user_id: new ObjectId(userId),
    _id: new ObjectId(notificationId),
  }
  const updateOperation = { $unset: { templateKey: true, messageOpts: true } }
  return await db.notifications.updateOne(searchOps, updateOperation)
}

async function removeNotificationKey(userId, notificationKey) {
  const searchOps = {
    user_id: new ObjectId(userId),
    key: notificationKey,
  }
  const updateOperation = { $unset: { templateKey: true } }
  return await db.notifications.updateOne(searchOps, updateOperation)
}

async function removeNotificationByKeyOnly(notificationKey) {
  const searchOps = { key: notificationKey }
  const updateOperation = { $unset: { templateKey: true } }
  return await db.notifications.updateOne(searchOps, updateOperation)
}

async function countNotificationsByKeyOnly(notificationKey) {
  const searchOps = { key: notificationKey, templateKey: { $exists: true } }
  return await db.notifications.countDocuments(searchOps)
}

async function deleteUnreadNotificationsByKeyOnlyBulk(notificationKey) {
  if (typeof notificationKey !== 'string') {
    throw new Error('refusing to bulk delete arbitrary notifications')
  }
  const searchOps = { key: notificationKey, templateKey: { $exists: true } }
  const result = await db.notifications.deleteMany(searchOps)
  return result.deletedCount
}

// hard delete of doc, rather than removing the templateKey
async function deleteNotificationByKeyOnly(notificationKey) {
  const searchOps = { key: notificationKey }
  return await db.notifications.deleteOne(searchOps)
}

export default {
  addNotification,
  getUserNotifications,
  removeNotificationId,
  removeNotificationKey,
  removeNotificationByKeyOnly,
  countNotificationsByKeyOnly,
  deleteUnreadNotificationsByKeyOnlyBulk,
  deleteNotificationByKeyOnly,
}

/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let Notifications
const logger = require('@overleaf/logger')
const { db, ObjectId } = require('./mongodb')
const metrics = require('@overleaf/metrics')

module.exports = Notifications = {
  getUserNotifications(userId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const query = {
      user_id: ObjectId(userId),
      templateKey: { $exists: true },
    }
    db.notifications.find(query).toArray(callback)
  },

  _countExistingNotifications(userId, notification, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const query = {
      user_id: ObjectId(userId),
      key: notification.key,
    }
    return db.notifications.count(query, function (err, count) {
      if (err != null) {
        return callback(err)
      }
      return callback(null, count)
    })
  },

  addNotification(userId, notification, callback) {
    return this._countExistingNotifications(
      userId,
      notification,
      function (err, count) {
        if (err != null) {
          return callback(err)
        }
        if (count !== 0 && !notification.forceCreate) {
          return callback()
        }
        const doc = {
          user_id: ObjectId(userId),
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
            const _testValue = doc.expires.toISOString()
          } catch (error) {
            err = error
            logger.error(
              { userId, expires: notification.expires },
              'error converting `expires` field to Date'
            )
            return callback(err)
          }
        }
        db.notifications.updateOne(
          { user_id: doc.user_id, key: notification.key },
          { $set: doc },
          { upsert: true },
          callback
        )
      }
    )
  },

  removeNotificationId(userId, notificationId, callback) {
    const searchOps = {
      user_id: ObjectId(userId),
      _id: ObjectId(notificationId),
    }
    const updateOperation = { $unset: { templateKey: true, messageOpts: true } }
    db.notifications.updateOne(searchOps, updateOperation, callback)
  },

  removeNotificationKey(userId, notificationKey, callback) {
    const searchOps = {
      user_id: ObjectId(userId),
      key: notificationKey,
    }
    const updateOperation = { $unset: { templateKey: true } }
    db.notifications.updateOne(searchOps, updateOperation, callback)
  },

  removeNotificationByKeyOnly(notificationKey, callback) {
    const searchOps = { key: notificationKey }
    const updateOperation = { $unset: { templateKey: true } }
    db.notifications.updateOne(searchOps, updateOperation, callback)
  },

  countNotificationsByKeyOnly(notificationKey, callback) {
    const searchOps = { key: notificationKey, templateKey: { $exists: true } }
    db.notifications.count(searchOps, callback)
  },

  deleteUnreadNotificationsByKeyOnlyBulk(notificationKey, callback) {
    if (typeof notificationKey !== 'string') {
      throw new Error('refusing to bulk delete arbitrary notifications')
    }
    const searchOps = { key: notificationKey, templateKey: { $exists: true } }
    db.notifications.deleteMany(searchOps, (err, result) => {
      if (err) return callback(err)
      callback(null, result.deletedCount)
    })
  },

  // hard delete of doc, rather than removing the templateKey
  deleteNotificationByKeyOnly(notificationKey, callback) {
    const searchOps = { key: notificationKey }
    db.notifications.deleteOne(searchOps, callback)
  },
}
;['getUserNotifications', 'addNotification'].map(method =>
  metrics.timeAsyncMethod(Notifications, method, 'mongo.Notifications', logger)
)

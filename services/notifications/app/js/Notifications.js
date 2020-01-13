/* eslint-disable
    camelcase,
    handle-callback-err,
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
const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const mongojs = require('mongojs')
const db = mongojs(Settings.mongo != null ? Settings.mongo.url : undefined, [
  'notifications'
])
const { ObjectId } = require('mongojs')
const metrics = require('metrics-sharelatex')

module.exports = Notifications = {
  getUserNotifications(user_id, callback) {
    if (callback == null) {
      callback = function(err, notifications) {}
    }
    const query = {
      user_id: ObjectId(user_id),
      templateKey: { $exists: true }
    }
    return db.notifications.find(query, (err, notifications) =>
      callback(err, notifications)
    )
  },

  _countExistingNotifications(user_id, notification, callback) {
    if (callback == null) {
      callback = function(err, count) {}
    }
    const query = {
      user_id: ObjectId(user_id),
      key: notification.key
    }
    return db.notifications.count(query, function(err, count) {
      if (err != null) {
        return callback(err)
      }
      return callback(null, count)
    })
  },

  addNotification(user_id, notification, callback) {
    return this._countExistingNotifications(user_id, notification, function(
      err,
      count
    ) {
      if (err != null) {
        return callback(err)
      }
      if (count !== 0 && !notification.forceCreate) {
        return callback()
      }
      const doc = {
        user_id: ObjectId(user_id),
        key: notification.key,
        messageOpts: notification.messageOpts,
        templateKey: notification.templateKey
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
            { user_id, expires: notification.expires },
            'error converting `expires` field to Date'
          )
          return callback(err)
        }
      }
      return db.notifications.update(
        { user_id: doc.user_id, key: notification.key },
        doc,
        { upsert: true },
        callback
      )
    })
  },

  removeNotificationId(user_id, notification_id, callback) {
    const searchOps = {
      user_id: ObjectId(user_id),
      _id: ObjectId(notification_id)
    }
    const updateOperation = { $unset: { templateKey: true, messageOpts: true } }
    return db.notifications.update(searchOps, updateOperation, callback)
  },

  removeNotificationKey(user_id, notification_key, callback) {
    const searchOps = {
      user_id: ObjectId(user_id),
      key: notification_key
    }
    const updateOperation = { $unset: { templateKey: true } }
    return db.notifications.update(searchOps, updateOperation, callback)
  },

  removeNotificationByKeyOnly(notification_key, callback) {
    const searchOps = { key: notification_key }
    const updateOperation = { $unset: { templateKey: true } }
    return db.notifications.update(searchOps, updateOperation, callback)
  },

  // hard delete of doc, rather than removing the templateKey
  deleteNotificationByKeyOnly(notification_key, callback) {
    const searchOps = { key: notification_key }
    return db.notifications.remove(searchOps, { justOne: true }, callback)
  }
}

;['getUserNotifications', 'addNotification'].map(method =>
  metrics.timeAsyncMethod(Notifications, method, 'mongo.Notifications', logger)
)

/* eslint-disable
    camelcase,
    max-len,
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
const settings = require('settings-sharelatex')
const request = require('request')
const logger = require('logger-sharelatex')

const oneSecond = 1000

const makeRequest = function(opts, callback) {
  if (
    (settings.apis.notifications != null
      ? settings.apis.notifications.url
      : undefined) == null
  ) {
    return callback(null, { statusCode: 200 })
  } else {
    return request(opts, callback)
  }
}

module.exports = {
  getUserNotifications(user_id, callback) {
    const opts = {
      uri: `${
        settings.apis.notifications != null
          ? settings.apis.notifications.url
          : undefined
      }/user/${user_id}`,
      json: true,
      timeout: oneSecond,
      method: 'GET'
    }
    return makeRequest(opts, function(err, res, unreadNotifications) {
      const statusCode = res != null ? res.statusCode : 500
      if (err != null || statusCode !== 200) {
        const e = new Error(
          `something went wrong getting notifications, ${err}, ${statusCode}`
        )
        logger.err({ err }, 'something went wrong getting notifications')
        return callback(null, [])
      } else {
        if (unreadNotifications == null) {
          unreadNotifications = []
        }
        return callback(null, unreadNotifications)
      }
    })
  },

  createNotification(
    user_id,
    key,
    templateKey,
    messageOpts,
    expiryDateTime,
    forceCreate,
    callback
  ) {
    if (!callback) {
      callback = forceCreate
      forceCreate = true
    }
    const payload = {
      key,
      messageOpts,
      templateKey,
      forceCreate
    }
    if (expiryDateTime != null) {
      payload.expires = expiryDateTime
    }
    const opts = {
      uri: `${
        settings.apis.notifications != null
          ? settings.apis.notifications.url
          : undefined
      }/user/${user_id}`,
      timeout: oneSecond,
      method: 'POST',
      json: payload
    }
    logger.log({ opts }, 'creating notification for user')
    return makeRequest(opts, callback)
  },

  markAsReadWithKey(user_id, key, callback) {
    const opts = {
      uri: `${
        settings.apis.notifications != null
          ? settings.apis.notifications.url
          : undefined
      }/user/${user_id}`,
      method: 'DELETE',
      timeout: oneSecond,
      json: {
        key
      }
    }
    logger.log(
      { user_id, key },
      'sending mark notification as read with key to notifications api'
    )
    return makeRequest(opts, callback)
  },

  markAsRead(user_id, notification_id, callback) {
    const opts = {
      method: 'DELETE',
      uri: `${
        settings.apis.notifications != null
          ? settings.apis.notifications.url
          : undefined
      }/user/${user_id}/notification/${notification_id}`,
      timeout: oneSecond
    }
    logger.log(
      { user_id, notification_id },
      'sending mark notification as read to notifications api'
    )
    return makeRequest(opts, callback)
  },

  // removes notification by key, without regard for user_id,
  // should not be exposed to user via ui/router
  markAsReadByKeyOnly(key, callback) {
    const opts = {
      uri: `${
        settings.apis.notifications != null
          ? settings.apis.notifications.url
          : undefined
      }/key/${key}`,
      method: 'DELETE',
      timeout: oneSecond
    }
    logger.log(
      { key },
      'sending mark notification as read with key-only to notifications api'
    )
    return makeRequest(opts, callback)
  }
}

/* eslint-disable
    no-dupe-keys,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { db, ObjectId } = require('./mongodb')
const request = require('request')
const async = require('async')
const settings = require('@overleaf/settings')
const { port } = settings.internal.notifications
const logger = require('@overleaf/logger')

module.exports = {
  check(callback) {
    const userId = ObjectId()
    const cleanupNotifications = callback =>
      db.notifications.remove({ user_id: userId }, callback)

    let notificationKey = `smoke-test-notification-${ObjectId()}`
    const getOpts = endPath => ({
      url: `http://localhost:${port}/user/${userId}${endPath}`,
      timeout: 5000,
    })
    logger.debug(
      { userId, opts: getOpts(), key: notificationKey, userId },
      'Health Check: running'
    )
    const jobs = [
      function (cb) {
        const opts = getOpts('/')
        opts.json = {
          key: notificationKey,
          messageOpts: '',
          templateKey: 'f4g5',
          user_id: userId,
        }
        return request.post(opts, cb)
      },
      function (cb) {
        const opts = getOpts('/')
        opts.json = true
        return request.get(opts, function (err, res, body) {
          if (err != null) {
            logger.err({ err }, 'Health Check: error getting notification')
            return callback(err)
          } else if (res.statusCode !== 200) {
            const e = `status code not 200 ${res.statusCode}`
            logger.err({ err }, e)
            return cb(e)
          }
          const hasNotification = body.some(
            notification =>
              notification.key === notificationKey &&
              notification.user_id === userId.toString()
          )
          if (hasNotification) {
            return cb(null, body)
          } else {
            logger.err(
              { body, notificationKey },
              'Health Check: notification not in response'
            )
            return cb(new Error('notification not found in response'))
          }
        })
      },
    ]
    return async.series(jobs, function (err, body) {
      if (err != null) {
        logger.err({ err }, 'Health Check: error running health check')
        return cleanupNotifications(() => callback(err))
      } else {
        const notificationId = body[1][0]._id
        notificationKey = body[1][0].key
        let opts = getOpts(`/notification/${notificationId}`)
        logger.debug(
          { notificationId, notificationKey },
          'Health Check: doing cleanup'
        )
        return request.del(opts, function (err, res, body) {
          if (err != null) {
            logger.err(
              err,
              opts,
              'Health Check: error cleaning up notification'
            )
            return callback(err)
          }
          opts = getOpts('')
          opts.json = { key: notificationKey }
          return request.del(opts, function (err, res, body) {
            if (err != null) {
              logger.err(
                err,
                opts,
                'Health Check: error cleaning up notification'
              )
              return callback(err)
            }
            return cleanupNotifications(callback)
          })
        })
      }
    })
  },
}

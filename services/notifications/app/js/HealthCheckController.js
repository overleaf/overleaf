/* eslint-disable
    camelcase,
    no-dupe-keys,
    standard/no-callback-literal,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { ObjectId } = require('mongojs')
const request = require('request')
const async = require('async')
const _ = require('underscore')
const settings = require('settings-sharelatex')
const { port } = settings.internal.notifications
const logger = require('logger-sharelatex')

const mongojs = require('mongojs')
const Settings = require('settings-sharelatex')
const db = mongojs(Settings.mongo != null ? Settings.mongo.url : undefined, [
  'notifications'
])

module.exports = {
  check(callback) {
    const user_id = ObjectId()
    const cleanupNotifications = callback =>
      db.notifications.remove({ user_id }, callback)

    let notification_key = `smoke-test-notification-${ObjectId()}`
    const getOpts = endPath => ({
      url: `http://localhost:${port}/user/${user_id}${endPath}`,
      timeout: 5000
    })
    logger.log(
      { user_id, opts: getOpts(), key: notification_key, user_id },
      'Health Check: running'
    )
    const jobs = [
      function(cb) {
        const opts = getOpts('/')
        opts.json = {
          key: notification_key,
          messageOpts: '',
          templateKey: 'f4g5',
          user_id
        }
        return request.post(opts, cb)
      },
      function(cb) {
        const opts = getOpts('/')
        opts.json = true
        return request.get(opts, function(err, res, body) {
          if (err != null) {
            logger.err({ err }, 'Health Check: error getting notification')
            return callback(err)
          } else if (res.statusCode !== 200) {
            const e = `status code not 200 ${res.statusCode}`
            logger.err({ err }, e)
            return cb(e)
          }
          const hasNotification = _.some(
            body,
            notification =>
              notification.key === notification_key &&
              notification.user_id === user_id.toString()
          )
          if (hasNotification) {
            return cb(null, body)
          } else {
            logger.err(
              { body, notification_key },
              'Health Check: notification not in response'
            )
            return cb('notification not found in response')
          }
        })
      }
    ]
    return async.series(jobs, function(err, body) {
      if (err != null) {
        logger.err({ err }, 'Health Check: error running health check')
        return cleanupNotifications(() => callback(err))
      } else {
        const notification_id = body[1][0]._id
        notification_key = body[1][0].key
        let opts = getOpts(`/notification/${notification_id}`)
        logger.log(
          { notification_id, notification_key },
          'Health Check: doing cleanup'
        )
        return request.del(opts, function(err, res, body) {
          if (err != null) {
            logger.err(
              err,
              opts,
              'Health Check: error cleaning up notification'
            )
            return callback(err)
          }
          opts = getOpts('')
          opts.json = { key: notification_key }
          return request.del(opts, function(err, res, body) {
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
  }
}

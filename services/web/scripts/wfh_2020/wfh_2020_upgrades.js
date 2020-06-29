const NotificationsHandler = require('../../app/src/Features/Notifications/NotificationsHandler')

const mongojs = require('../../app/src/infrastructure/mongojs')
const { db } = mongojs
const async = require('async')

const templateKey = 'wfh_2020_upgrade_offer'
const oldKey = 'wfh-2020-upgrade-2020-06-01'
const key = 'wfh-2020-upgrade-2020-06-18'

db.subscriptions.aggregate(
  { $match: { teamName: /(Work From Home|Work from Home)/ } },
  { $unwind: '$member_ids' },
  { $group: { _id: null, memberIds: { $addToSet: '$member_ids' } } },
  function(err, results) {
    if (err) {
      throw err
    }

    const userIds = results[0].memberIds

    async.eachLimit(
      userIds,
      10,
      function(userId, callback) {
        async.series(
          [
            function(cb) {
              db.notifications.findOne(
                { user_id: userId, key: oldKey },
                function(err, notification) {
                  if (err) {
                    console.log('Error finding notification for ' + userId)
                    cb(err)
                  } else if (!notification) {
                    cb()
                  } else {
                    if (notification.templateKey && notification.messageOpts) {
                      db.notifications.update(
                        {
                          _id: notification._id
                        },
                        {
                          $unset: { templateKey: true, messageOpts: true }
                        },
                        cb
                      )
                    } else {
                      cb()
                    }
                  }
                }
              )
            },
            function(cb) {
              NotificationsHandler.createNotification(
                userId,
                key,
                templateKey,
                {},
                null,
                true,
                cb
              )
            }
          ],
          function(err) {
            if (err) {
              callback(err)
            } else {
              console.log('Notification created for user ' + userId)
              callback()
            }
          }
        )
      },
      function(err) {
        if (err) {
          console.log(err)
          process.exit(1)
        } else {
          console.log('Done')
          process.exit(0)
        }
      }
    )
  }
)

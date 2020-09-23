const NotificationsHandler = require('../../app/src/Features/Notifications/NotificationsHandler')

const { db } = require('../../app/src/infrastructure/mongojs')
const async = require('async')

const templateKey = 'wfh_2020_upgrade_offer'
const key = 'wfh-2020-upgrade-2020-06-01'

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
        NotificationsHandler.createNotification(
          userId,
          key,
          templateKey,
          {},
          null,
          true,
          function(err) {
            if (err) {
              return callback(err)
            }
            console.log('Notification created for user ' + userId)
            callback()
          }
        )
      },
      function() {
        console.log('Done')
        process.exit(0)
      }
    )
  }
)

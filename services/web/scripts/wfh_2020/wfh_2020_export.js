const { db } = require('../../app/src/infrastructure/mongojs')
const async = require('async')

db.deletedSubscriptions.aggregate(
  { $match: { 'subscription.teamName': /(Work From Home|Work from Home)/ } },
  { $unwind: '$subscription.member_ids' },
  {
    $group: { _id: null, memberIds: { $addToSet: '$subscription.member_ids' } }
  },
  function(err, results) {
    if (err) {
      console.error(err)
      process.exit(1)
    }

    if (!results.length) {
      console.error('No users found')
      process.exit(1)
    }

    const userIds = results[0].memberIds

    console.log('Id,First Name,Last Name,Sign Up Date,Emails')

    async.eachLimit(
      userIds,
      10,
      function(userId, callback) {
        db.users.findOne(userId, function(err, user) {
          if (user) {
            const emails = user.emails.map(email => email.email)
            console.log(
              `${user._id},${user.first_name || ''},${user.last_name || ''},${
                user.signUpDate
              },${emails.join(',')}`
            )
          } else {
            console.error('A group user was not found')
          }
          callback(err)
        })
      },
      function(err) {
        if (err) {
          console.error(err)
          process.exit(1)
        }

        process.exit(0)
      }
    )
  }
)

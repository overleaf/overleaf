const { db, ObjectId } = require('../../infrastructure/mongojs')
const UserUpdater = require('./UserUpdater')
const EmailHandler = require('../Email/EmailHandler')
const logger = require('logger-sharelatex')
const async = require('async')
const _ = require('underscore')

module.exports = {
  sendRecentSignupOnboardingEmails(req, res, next) {
    res.setTimeout(600 * 1000) // increase timeout to handle days with a lot of signups

    // find all the users with no onboardingEmailSentAt and
    // have signed up in the last 7 days
    db.users.find(
      {
        onboardingEmailSentAt: null,
        _id: {
          $gt: ObjectId.createFromTime(Date.now() / 1000 - 7 * 24 * 60 * 60)
        }
      },
      { email: 1 },
      function(error, users) {
        if (error) {
          return next(error)
        }
        const ids = _.map(users, function(user) {
          return user._id
        })
        logger.log('SENDING USER ONBOARDING EMAILS TO: ', ids)
        async.mapLimit(users, 10, sendOne, function(error) {
          if (error) {
            return next(error)
          }
          logger.log('DONE SENDING ONBOARDING EMAILS')
          res.send(ids)
        })
      }
    )
  }
}

function sendOne(user, callback) {
  var opts = {
    to: user.email
  }
  EmailHandler.sendEmail('userOnboardingEmail', opts, function(error) {
    if (error) {
      return callback(error)
    }
    UserUpdater.updateUser(
      user._id,
      { $set: { onboardingEmailSentAt: new Date() } },
      function() {
        callback()
      }
    )
  })
}

const logger = require('logger-sharelatex')
const mongojs = require('../../infrastructure/mongojs')
const metrics = require('metrics-sharelatex')
const { db } = mongojs
const async = require('async')
const { ObjectId } = mongojs
const UserGetter = require('./UserGetter')
const {
  addAffiliation,
  removeAffiliation
} = require('../Institutions/InstitutionsAPI')
const FeaturesUpdater = require('../Subscription/FeaturesUpdater')
const EmailHelper = require('../Helpers/EmailHelper')
const Errors = require('../Errors/Errors')
const NewsletterManager = require('../Newsletter/NewsletterManager')

const UserUpdater = {
  updateUser(query, update, callback) {
    if (callback == null) {
      callback = () => {}
    }
    if (typeof query === 'string') {
      query = { _id: ObjectId(query) }
    } else if (query instanceof ObjectId) {
      query = { _id: query }
    } else if (typeof query._id === 'string') {
      query._id = ObjectId(query._id)
    }

    db.users.update(query, update, callback)
  },

  //
  // DEPRECATED
  //
  // Change the user's main email address by adding a new email, switching the
  // default email and removing the old email.  Prefer manipulating multiple
  // emails and the default rather than calling this method directly
  //
  changeEmailAddress(userId, newEmail, callback) {
    newEmail = EmailHelper.parseEmail(newEmail)
    if (newEmail == null) {
      return callback(new Error('invalid email'))
    }
    logger.log({ userId, newEmail }, 'updaing email address of user')

    let oldEmail = null
    async.series(
      [
        cb =>
          UserGetter.getUserEmail(userId, (error, email) => {
            oldEmail = email
            cb(error)
          }),
        cb => UserUpdater.addEmailAddress(userId, newEmail, cb),
        cb => UserUpdater.setDefaultEmailAddress(userId, newEmail, true, cb),
        cb => UserUpdater.removeEmailAddress(userId, oldEmail, cb)
      ],
      callback
    )
  },

  // Add a new email address for the user. Email cannot be already used by this
  // or any other user
  addEmailAddress(userId, newEmail, affiliationOptions, callback) {
    if (callback == null) {
      // affiliationOptions is optional
      callback = affiliationOptions
      affiliationOptions = {}
    }
    newEmail = EmailHelper.parseEmail(newEmail)
    if (newEmail == null) {
      return callback(new Error('invalid email'))
    }

    UserGetter.ensureUniqueEmailAddress(newEmail, error => {
      if (error != null) {
        return callback(error)
      }

      addAffiliation(userId, newEmail, affiliationOptions, error => {
        if (error != null) {
          logger.warn(
            { error },
            'problem adding affiliation while adding email'
          )
          return callback(error)
        }

        const reversedHostname = newEmail
          .split('@')[1]
          .split('')
          .reverse()
          .join('')
        const update = {
          $push: {
            emails: { email: newEmail, createdAt: new Date(), reversedHostname }
          }
        }
        UserUpdater.updateUser(userId, update, error => {
          if (error != null) {
            logger.warn({ error }, 'problem updating users emails')
            return callback(error)
          }
          callback()
        })
      })
    })
  },

  // remove one of the user's email addresses. The email cannot be the user's
  // default email address
  removeEmailAddress(userId, email, callback) {
    email = EmailHelper.parseEmail(email)
    if (email == null) {
      return callback(new Error('invalid email'))
    }
    removeAffiliation(userId, email, error => {
      if (error != null) {
        logger.warn({ error }, 'problem removing affiliation')
        return callback(error)
      }

      const query = { _id: userId, email: { $ne: email } }
      const update = { $pull: { emails: { email } } }
      UserUpdater.updateUser(query, update, (error, res) => {
        if (error != null) {
          logger.warn({ error }, 'problem removing users email')
          return callback(error)
        }
        if (res.n === 0) {
          return callback(new Error('Cannot remove email'))
        }
        callback()
      })
    })
  },

  // set the default email address by setting the `email` attribute. The email
  // must be one of the user's multiple emails (`emails` attribute)
  setDefaultEmailAddress(userId, email, allowUnconfirmed, callback) {
    if (typeof allowUnconfirmed === 'function') {
      callback = allowUnconfirmed
      allowUnconfirmed = false
    }
    email = EmailHelper.parseEmail(email)
    if (email == null) {
      return callback(new Error('invalid email'))
    }
    UserGetter.getUser(userId, { email: 1, emails: 1 }, (err, user) => {
      if (err) {
        return callback(err)
      }
      if (!user) {
        return callback(new Error('invalid userId'))
      }
      const oldEmail = user.email
      const userEmail = user.emails.find(e => e.email === email)
      if (!userEmail) {
        return callback(new Error('Default email does not belong to user'))
      }
      if (!userEmail.confirmedAt && !allowUnconfirmed) {
        return callback(new Errors.UnconfirmedEmailError())
      }
      const query = { _id: userId, 'emails.email': email }
      const update = { $set: { email } }
      UserUpdater.updateUser(query, update, (err, res) => {
        if (err) {
          return callback(err)
        }
        // this should not happen
        if (res.n === 0) {
          return callback(new Error('email update error'))
        }
        NewsletterManager.changeEmail(oldEmail, email, err => {
          if (err != null) {
            logger.warn(
              { err, oldEmail, newEmail: email },
              'Failed to change email in newsletter subscription'
            )
          }
        })
        callback()
      })
    })
  },

  confirmEmail(userId, email, confirmedAt, callback) {
    if (arguments.length === 3) {
      callback = confirmedAt
      confirmedAt = new Date()
    }
    email = EmailHelper.parseEmail(email)
    if (email == null) {
      return callback(new Error('invalid email'))
    }
    logger.log({ userId, email }, 'confirming user email')
    addAffiliation(userId, email, { confirmedAt }, error => {
      if (error != null) {
        logger.warn(
          { error },
          'problem adding affiliation while confirming email'
        )
        return callback(error)
      }

      const query = {
        _id: userId,
        'emails.email': email
      }
      const update = {
        $set: {
          'emails.$.confirmedAt': confirmedAt
        }
      }
      UserUpdater.updateUser(query, update, (error, res) => {
        if (error != null) {
          return callback(error)
        }
        logger.log({ res, userId, email }, 'tried to confirm email')
        if (res.n === 0) {
          return callback(
            new Errors.NotFoundError('user id and email do no match')
          )
        }
        FeaturesUpdater.refreshFeatures(userId, callback)
      })
    })
  },

  removeReconfirmFlag(userId, callback) {
    UserUpdater.updateUser(
      userId.toString(),
      {
        $set: { must_reconfirm: false }
      },
      error => callback(error)
    )
  }
}
;[
  'updateUser',
  'changeEmailAddress',
  'setDefaultEmailAddress',
  'addEmailAddress',
  'removeEmailAddress',
  'removeReconfirmFlag'
].map(method =>
  metrics.timeAsyncMethod(UserUpdater, method, 'mongo.UserUpdater', logger)
)

module.exports = UserUpdater

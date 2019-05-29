/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let UserUpdater
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
const Settings = require('settings-sharelatex')
const request = require('request')
const NewsletterManager = require('../Newsletter/NewsletterManager')

module.exports = UserUpdater = {
  updateUser(query, update, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    if (typeof query === 'string') {
      query = { _id: ObjectId(query) }
    } else if (query instanceof ObjectId) {
      query = { _id: query }
    } else if (typeof query._id === 'string') {
      query._id = ObjectId(query._id)
    }

    return db.users.update(query, update, callback)
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
    return async.series(
      [
        cb =>
          UserGetter.getUserEmail(userId, function(error, email) {
            oldEmail = email
            return cb(error)
          }),
        cb => UserUpdater.addEmailAddress(userId, newEmail, cb),
        cb => UserUpdater.setDefaultEmailAddress(userId, newEmail, cb),
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

    return UserGetter.ensureUniqueEmailAddress(newEmail, error => {
      if (error != null) {
        return callback(error)
      }

      return addAffiliation(userId, newEmail, affiliationOptions, error => {
        if (error != null) {
          logger.err({ error }, 'problem adding affiliation while adding email')
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
        return this.updateUser(userId, update, function(error) {
          if (error != null) {
            logger.err({ error }, 'problem updating users emails')
            return callback(error)
          }
          return callback()
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
    return removeAffiliation(userId, email, error => {
      if (error != null) {
        logger.err({ error }, 'problem removing affiliation')
        return callback(error)
      }

      const query = { _id: userId, email: { $ne: email } }
      const update = { $pull: { emails: { email } } }
      return this.updateUser(query, update, function(error, res) {
        if (error != null) {
          logger.err({ error }, 'problem removing users email')
          return callback(error)
        }
        if (res.n === 0) {
          return callback(new Error('Cannot remove email'))
        }
        return callback()
      })
    })
  },

  // set the default email address by setting the `email` attribute. The email
  // must be one of the user's multiple emails (`emails` attribute)
  setDefaultEmailAddress(userId, email, callback) {
    email = EmailHelper.parseEmail(email)
    if (email == null) {
      return callback(new Error('invalid email'))
    }
    return UserGetter.getUserEmail(userId, (error, oldEmail) => {
      if (typeof err !== 'undefined' && err !== null) {
        return callback(error)
      }
      const query = { _id: userId, 'emails.email': email }
      const update = { $set: { email } }
      return this.updateUser(query, update, function(error, res) {
        if (error != null) {
          logger.err({ error }, 'problem setting default emails')
          return callback(error)
        } else if (res.n === 0) {
          // TODO: Check n or nMatched?
          return callback(new Error('Default email does not belong to user'))
        } else {
          NewsletterManager.changeEmail(oldEmail, email, function() {})
          return callback()
        }
      })
    })
  },

  updateV1AndSetDefaultEmailAddress(userId, email, callback) {
    return this.updateEmailAddressInV1(userId, email, error => {
      if (error != null) {
        return callback(error)
      }
      return this.setDefaultEmailAddress(userId, email, callback)
    })
  },

  updateEmailAddressInV1(userId, newEmail, callback) {
    if (
      __guard__(
        Settings.apis != null ? Settings.apis.v1 : undefined,
        x => x.url
      ) == null
    ) {
      return callback()
    }
    return UserGetter.getUser(userId, { 'overleaf.id': 1, emails: 1 }, function(
      error,
      user
    ) {
      let email
      if (error != null) {
        return callback(error)
      }
      if (user == null) {
        return callback(new Errors.NotFoundError('no user found'))
      }
      if ((user.overleaf != null ? user.overleaf.id : undefined) == null) {
        return callback()
      }
      let newEmailIsConfirmed = false
      for (email of Array.from(user.emails)) {
        if (email.email === newEmail && email.confirmedAt != null) {
          newEmailIsConfirmed = true
          break
        }
      }
      if (!newEmailIsConfirmed) {
        return callback(
          new Errors.UnconfirmedEmailError(
            "can't update v1 with unconfirmed email"
          )
        )
      }
      return request(
        {
          baseUrl: Settings.apis.v1.url,
          url: `/api/v1/sharelatex/users/${user.overleaf.id}/email`,
          method: 'PUT',
          auth: {
            user: Settings.apis.v1.user,
            pass: Settings.apis.v1.pass,
            sendImmediately: true
          },
          json: {
            user: {
              email: newEmail
            }
          },
          timeout: 5 * 1000
        },
        function(error, response, body) {
          if (error != null) {
            if (error.code === 'ECONNREFUSED') {
              error = new Errors.V1ConnectionError('No V1 connection')
            }
            return callback(error)
          }
          if (response.statusCode === 409) {
            // Conflict
            return callback(new Errors.EmailExistsError('email exists in v1'))
          } else if (response.statusCode >= 200 && response.statusCode < 300) {
            return callback()
          } else {
            return callback(
              new Error(`non-success code from v1: ${response.statusCode}`)
            )
          }
        }
      )
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
    return addAffiliation(userId, email, { confirmedAt }, error => {
      if (error != null) {
        logger.err(
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
      return this.updateUser(query, update, function(error, res) {
        if (error != null) {
          return callback(error)
        }
        logger.log({ res, userId, email }, 'tried to confirm email')
        if (res.n === 0) {
          return callback(
            new Errors.NotFoundError('user id and email do no match')
          )
        }
        return FeaturesUpdater.refreshFeatures(userId, true, callback)
      })
    })
  },

  removeReconfirmFlag(user_id, callback) {
    return UserUpdater.updateUser(
      user_id.toString(),
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

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}

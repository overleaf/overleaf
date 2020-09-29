const logger = require('logger-sharelatex')
const OError = require('@overleaf/o-error')
const { db, ObjectId } = require('../../infrastructure/mongojs')
const metrics = require('metrics-sharelatex')
const async = require('async')
const { callbackify, promisify } = require('util')
const UserGetter = require('./UserGetter')
const {
  addAffiliation,
  removeAffiliation,
  promises: InstitutionsAPIPromises
} = require('../Institutions/InstitutionsAPI')
const Features = require('../../infrastructure/Features')
const FeaturesUpdater = require('../Subscription/FeaturesUpdater')
const EmailHandler = require('../Email/EmailHandler')
const EmailHelper = require('../Helpers/EmailHelper')
const Errors = require('../Errors/Errors')
const NewsletterManager = require('../Newsletter/NewsletterManager')
const RecurlyWrapper = require('../Subscription/RecurlyWrapper')
const UserAuditLogHandler = require('./UserAuditLogHandler')

async function _sendSecurityAlertPrimaryEmailChanged(userId, oldEmail, email) {
  // send email to both old and new primary email
  const emailOptions = {
    actionDescribed: `the primary email address on your account was changed to ${email}`,
    action: 'change of primary email address'
  }
  const toOld = Object.assign({}, emailOptions, { to: oldEmail })
  const toNew = Object.assign({}, emailOptions, { to: email })

  try {
    await EmailHandler.promises.sendEmail('securityAlert', toOld)
    await EmailHandler.promises.sendEmail('securityAlert', toNew)
  } catch (error) {
    logger.error(
      { error, userId },
      'could not send security alert email when primary email changed'
    )
  }
}

async function addEmailAddress(userId, newEmail, affiliationOptions, auditLog) {
  newEmail = EmailHelper.parseEmail(newEmail)
  if (!newEmail) {
    throw new Error('invalid email')
  }

  await UserGetter.promises.ensureUniqueEmailAddress(newEmail)

  await UserAuditLogHandler.promises.addEntry(
    userId,
    'add-email',
    auditLog.initiatorId,
    auditLog.ipAddress,
    {
      newSecondaryEmail: newEmail
    }
  )

  try {
    await InstitutionsAPIPromises.addAffiliation(
      userId,
      newEmail,
      affiliationOptions
    )
  } catch (error) {
    throw OError.tag(error, 'problem adding affiliation while adding email')
  }

  try {
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
    await UserUpdater.promises.updateUser(userId, update)
  } catch (error) {
    throw OError.tag(error, 'problem updating users emails')
  }
}

async function setDefaultEmailAddress(
  userId,
  email,
  allowUnconfirmed,
  auditLog,
  sendSecurityAlert
) {
  email = EmailHelper.parseEmail(email)
  if (email == null) {
    throw new Error('invalid email')
  }

  const user = await UserGetter.promises.getUser(userId, {
    email: 1,
    emails: 1
  })
  if (!user) {
    throw new Error('invalid userId')
  }

  const oldEmail = user.email
  const userEmail = user.emails.find(e => e.email === email)
  if (!userEmail) {
    throw new Error('Default email does not belong to user')
  }
  if (!userEmail.confirmedAt && !allowUnconfirmed) {
    throw new Errors.UnconfirmedEmailError()
  }

  await UserAuditLogHandler.promises.addEntry(
    userId,
    'change-primary-email',
    auditLog.initiatorId,
    auditLog.ipAddress,
    {
      newPrimaryEmail: email,
      oldPrimaryEmail: oldEmail
    }
  )

  const query = { _id: userId, 'emails.email': email }
  const update = { $set: { email } }
  const res = await UserUpdater.promises.updateUser(query, update)

  // this should not happen
  if (res.n === 0) {
    throw new Error('email update error')
  }

  if (sendSecurityAlert) {
    // no need to wait, errors are logged and not passed back
    _sendSecurityAlertPrimaryEmailChanged(userId, oldEmail, email)
  }

  try {
    await NewsletterManager.promises.changeEmail(user, email)
  } catch (error) {
    logger.warn(
      { err: error, oldEmail, newEmail: email },
      'Failed to change email in newsletter subscription'
    )
  }

  try {
    await RecurlyWrapper.promises.updateAccountEmailAddress(user._id, email)
  } catch (error) {
    // errors are ignored
  }
}

const UserUpdater = {
  addAffiliationForNewUser(userId, email, affiliationOptions, callback) {
    if (callback == null) {
      // affiliationOptions is optional
      callback = affiliationOptions
      affiliationOptions = {}
    }
    addAffiliation(userId, email, affiliationOptions, error => {
      if (error) {
        return callback(error)
      }
      UserUpdater.updateUser(
        { _id: userId, 'emails.email': email },
        { $unset: { 'emails.$.affiliationUnchecked': 1 } },
        error => {
          if (error) {
            callback(
              OError.tag(
                error,
                'could not remove affiliationUnchecked flag for user on create',
                {
                  userId,
                  email
                }
              )
            )
          } else {
            callback()
          }
        }
      )
    })
  },

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
  changeEmailAddress(userId, newEmail, auditLog, callback) {
    newEmail = EmailHelper.parseEmail(newEmail)
    if (newEmail == null) {
      return callback(new Error('invalid email'))
    }

    let oldEmail = null
    async.series(
      [
        cb =>
          UserGetter.getUserEmail(userId, (error, email) => {
            oldEmail = email
            cb(error)
          }),
        cb => UserUpdater.addEmailAddress(userId, newEmail, {}, auditLog, cb),
        cb =>
          UserUpdater.setDefaultEmailAddress(
            userId,
            newEmail,
            true,
            auditLog,
            true,
            cb
          ),
        cb => UserUpdater.removeEmailAddress(userId, oldEmail, cb)
      ],
      callback
    )
  },

  // Add a new email address for the user. Email cannot be already used by this
  // or any other user
  addEmailAddress: callbackify(addEmailAddress),

  // remove one of the user's email addresses. The email cannot be the user's
  // default email address
  removeEmailAddress(userId, email, callback) {
    email = EmailHelper.parseEmail(email)
    if (email == null) {
      return callback(new Error('invalid email'))
    }
    removeAffiliation(userId, email, error => {
      if (error != null) {
        OError.tag(error, 'problem removing affiliation')
        return callback(error)
      }

      const query = { _id: userId, email: { $ne: email } }
      const update = { $pull: { emails: { email } } }
      UserUpdater.updateUser(query, update, (error, res) => {
        if (error != null) {
          OError.tag(error, 'problem removing users email')
          return callback(error)
        }
        if (res.n === 0) {
          return callback(new Error('Cannot remove email'))
        }
        FeaturesUpdater.refreshFeatures(userId, callback)
      })
    })
  },

  // set the default email address by setting the `email` attribute. The email
  // must be one of the user's multiple emails (`emails` attribute)
  setDefaultEmailAddress: callbackify(setDefaultEmailAddress),

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
        OError.tag(error, 'problem adding affiliation while confirming email')
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
      if (Features.hasFeature('affiliations')) {
        update['$unset'] = {
          'emails.$.affiliationUnchecked': 1
        }
      }
      UserUpdater.updateUser(query, update, (error, res) => {
        if (error != null) {
          return callback(error)
        }
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

const promises = {
  addAffiliationForNewUser: promisify(UserUpdater.addAffiliationForNewUser),
  addEmailAddress,
  confirmEmail: promisify(UserUpdater.confirmEmail),
  setDefaultEmailAddress,
  updateUser: promisify(UserUpdater.updateUser),
  removeReconfirmFlag: promisify(UserUpdater.removeReconfirmFlag)
}

UserUpdater.promises = promises

module.exports = UserUpdater

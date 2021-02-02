const { callbackify } = require('util')
const { db } = require('../../infrastructure/mongodb')
const metrics = require('@overleaf/metrics')
const logger = require('logger-sharelatex')
const moment = require('moment')
const settings = require('settings-sharelatex')
const { promisifyAll } = require('../../util/promises')
const {
  promises: InstitutionsAPIPromises
} = require('../Institutions/InstitutionsAPI')
const InstitutionsHelper = require('../Institutions/InstitutionsHelper')
const Errors = require('../Errors/Errors')
const Features = require('../../infrastructure/Features')
const { normalizeQuery, normalizeMultiQuery } = require('../Helpers/Mongo')

function _emailInReconfirmNotificationPeriod(emailData, institutionData) {
  const globalReconfirmPeriod = settings.reconfirmNotificationDays
  if (!globalReconfirmPeriod) return false

  // only show notification for institutions with reconfirmation enabled
  if (!institutionData || !institutionData.maxConfirmationMonths) return false

  if (!emailData.confirmedAt) return false

  if (institutionData.ssoEnabled && !emailData.samlProviderId) {
    // For SSO, only show notification for linked email
    return false
  }

  // reconfirmedAt will not always be set, use confirmedAt as fallback
  const lastConfirmed = emailData.reconfirmedAt || emailData.confirmedAt

  const lastDayToReconfirm = moment(lastConfirmed).add(
    institutionData.maxConfirmationMonths,
    'months'
  )
  const notificationStarts = moment(lastDayToReconfirm).subtract(
    globalReconfirmPeriod,
    'days'
  )

  return moment().isAfter(notificationStarts)
}

async function getUserFullEmails(userId) {
  const user = await UserGetter.promises.getUser(userId, {
    email: 1,
    emails: 1,
    samlIdentifiers: 1
  })

  if (!user) {
    throw new Error('User not Found')
  }

  if (!Features.hasFeature('affiliations')) {
    return decorateFullEmails(user.email, user.emails, [], [])
  }

  const affiliationsData = await InstitutionsAPIPromises.getUserAffiliations(
    userId
  )

  return decorateFullEmails(
    user.email,
    user.emails || [],
    affiliationsData,
    user.samlIdentifiers || []
  )
}

const UserGetter = {
  getUser(query, projection, callback) {
    if (arguments.length === 2) {
      callback = projection
      projection = {}
    }
    try {
      query = normalizeQuery(query)
      db.users.findOne(query, { projection }, callback)
    } catch (err) {
      callback(err)
    }
  },

  getUserEmail(userId, callback) {
    this.getUser(userId, { email: 1 }, (error, user) =>
      callback(error, user && user.email)
    )
  },

  getUserFullEmails: callbackify(getUserFullEmails),

  getUserByMainEmail(email, projection, callback) {
    email = email.trim()
    if (arguments.length === 2) {
      callback = projection
      projection = {}
    }
    db.users.findOne({ email }, { projection }, callback)
  },

  getUserByAnyEmail(email, projection, callback) {
    email = email.trim()
    if (arguments.length === 2) {
      callback = projection
      projection = {}
    }
    // $exists: true MUST be set to use the partial index
    const query = { emails: { $exists: true }, 'emails.email': email }
    db.users.findOne(query, { projection }, (error, user) => {
      if (error || user) {
        return callback(error, user)
      }

      // While multiple emails are being rolled out, check for the main email as
      // well
      this.getUserByMainEmail(email, projection, callback)
    })
  },

  getUsersByAnyConfirmedEmail(emails, projection, callback) {
    if (arguments.length === 2) {
      callback = projection
      projection = {}
    }

    const query = {
      'emails.email': { $in: emails }, // use the index on emails.email
      emails: {
        $exists: true,
        $elemMatch: {
          email: { $in: emails },
          confirmedAt: { $exists: true }
        }
      }
    }

    db.users.find(query, { projection }).toArray(callback)
  },

  getUsersByV1Ids(v1Ids, projection, callback) {
    if (arguments.length === 2) {
      callback = projection
      projection = {}
    }
    const query = { 'overleaf.id': { $in: v1Ids } }
    db.users.find(query, { projection }).toArray(callback)
  },

  getUsersByHostname(hostname, projection, callback) {
    const reversedHostname = hostname
      .trim()
      .split('')
      .reverse()
      .join('')
    const query = {
      emails: { $exists: true },
      'emails.reversedHostname': reversedHostname
    }
    db.users.find(query, { projection }).toArray(callback)
  },

  getUsers(query, projection, callback) {
    try {
      query = normalizeMultiQuery(query)
      db.users.find(query, { projection }).toArray(callback)
    } catch (err) {
      callback(err)
    }
  },

  // check for duplicate email address. This is also enforced at the DB level
  ensureUniqueEmailAddress(newEmail, callback) {
    this.getUserByAnyEmail(newEmail, function(error, user) {
      if (user) {
        return callback(new Errors.EmailExistsError())
      }
      callback(error)
    })
  }
}

var decorateFullEmails = (
  defaultEmail,
  emailsData,
  affiliationsData,
  samlIdentifiers
) => {
  emailsData.forEach(function(emailData) {
    emailData.default = emailData.email === defaultEmail

    const affiliation = affiliationsData.find(
      aff => aff.email === emailData.email
    )
    if (affiliation) {
      const {
        institution,
        inferred,
        role,
        department,
        licence,
        portal
      } = affiliation
      const inReconfirmNotificationPeriod = _emailInReconfirmNotificationPeriod(
        emailData,
        institution
      )
      emailData.affiliation = {
        institution,
        inferred,
        inReconfirmNotificationPeriod,
        role,
        department,
        licence,
        portal
      }
    }

    if (emailData.samlProviderId) {
      emailData.samlIdentifier = samlIdentifiers.find(
        samlIdentifier => samlIdentifier.providerId === emailData.samlProviderId
      )
    }

    emailData.emailHasInstitutionLicence = InstitutionsHelper.emailHasLicence(
      emailData
    )
  })

  return emailsData
}
;[
  'getUser',
  'getUserEmail',
  'getUserByMainEmail',
  'getUserByAnyEmail',
  'getUsers',
  'ensureUniqueEmailAddress'
].map(method =>
  metrics.timeAsyncMethod(UserGetter, method, 'mongo.UserGetter', logger)
)

UserGetter.promises = promisifyAll(UserGetter, {
  without: ['getUserFullEmails']
})
UserGetter.promises.getUserFullEmails = getUserFullEmails

module.exports = UserGetter

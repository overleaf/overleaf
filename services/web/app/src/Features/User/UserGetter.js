const { callbackify } = require('util')
const { db } = require('../../infrastructure/mongodb')
const moment = require('moment')
const settings = require('@overleaf/settings')
const { promisifyAll } = require('@overleaf/promise-utils')
const {
  promises: InstitutionsAPIPromises,
} = require('../Institutions/InstitutionsAPI')
const InstitutionsHelper = require('../Institutions/InstitutionsHelper')
const Errors = require('../Errors/Errors')
const Features = require('../../infrastructure/Features')
const { User } = require('../../models/User')
const { normalizeQuery, normalizeMultiQuery } = require('../Helpers/Mongo')

function _lastDayToReconfirm(emailData, institutionData) {
  const globalReconfirmPeriod = settings.reconfirmNotificationDays
  if (!globalReconfirmPeriod) return undefined

  // only show notification for institutions with reconfirmation enabled
  if (!institutionData || !institutionData.maxConfirmationMonths)
    return undefined

  if (!emailData.confirmedAt) return undefined

  if (institutionData.ssoEnabled && !emailData.samlProviderId) {
    // For SSO, only show notification for linked email
    return false
  }

  // reconfirmedAt will not always be set, use confirmedAt as fallback
  const lastConfirmed = emailData.reconfirmedAt || emailData.confirmedAt

  return moment(lastConfirmed)
    .add(institutionData.maxConfirmationMonths, 'months')
    .toDate()
}

function _pastReconfirmDate(lastDayToReconfirm) {
  if (!lastDayToReconfirm) return false
  return moment(lastDayToReconfirm).isBefore()
}

function _emailInReconfirmNotificationPeriod(cachedLastDayToReconfirm) {
  const globalReconfirmPeriod = settings.reconfirmNotificationDays

  if (!globalReconfirmPeriod || !cachedLastDayToReconfirm) return false

  const notificationStarts = moment(cachedLastDayToReconfirm).subtract(
    globalReconfirmPeriod,
    'days'
  )

  return moment().isAfter(notificationStarts)
}

async function getUserFullEmails(userId) {
  const user = await UserGetter.promises.getUser(userId, {
    email: 1,
    emails: 1,
    samlIdentifiers: 1,
  })

  if (!user) {
    throw new Error('User not Found')
  }

  if (!Features.hasFeature('affiliations')) {
    return decorateFullEmails(user.email, user.emails, [], [])
  }

  const affiliationsData =
    await InstitutionsAPIPromises.getUserAffiliations(userId)

  return decorateFullEmails(
    user.email,
    user.emails || [],
    affiliationsData,
    user.samlIdentifiers || []
  )
}

async function getUserConfirmedEmails(userId) {
  const user = await UserGetter.promises.getUser(userId, {
    emails: 1,
  })

  if (!user) {
    throw new Error('User not Found')
  }

  return user.emails.filter(email => !!email.confirmedAt)
}

async function getSsoUsersAtInstitution(institutionId, projection) {
  if (!projection) {
    throw new Error('missing projection')
  }

  return await User.find(
    {
      'samlIdentifiers.providerId': institutionId.toString(),
    },
    projection
  ).exec()
}

const UserGetter = {
  getSsoUsersAtInstitution: callbackify(getSsoUsersAtInstitution),

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

  getUserFeatures(userId, callback) {
    this.getUser(userId, { features: 1 }, (error, user) => {
      if (error) return callback(error)
      if (!user) return callback(new Errors.NotFoundError('user not found'))
      callback(null, user.features)
    })
  },

  getUserEmail(userId, callback) {
    this.getUser(userId, { email: 1 }, (error, user) =>
      callback(error, user && user.email)
    )
  },

  getUserFullEmails: callbackify(getUserFullEmails),

  getUserConfirmedEmails: callbackify(getUserConfirmedEmails),

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
          confirmedAt: { $exists: true },
        },
      },
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
    const reversedHostname = hostname.trim().split('').reverse().join('')
    const query = {
      emails: { $exists: true },
      'emails.reversedHostname': reversedHostname,
    }
    db.users.find(query, { projection }).toArray(callback)
  },

  getInstitutionUsersByHostname(hostname, callback) {
    const projection = {
      _id: 1,
      email: 1,
      emails: 1,
      samlIdentifiers: 1,
    }
    UserGetter.getUsersByHostname(hostname, projection, (err, users) => {
      if (err) return callback(err)

      users.forEach(user => {
        user.emails = decorateFullEmails(
          user.email,
          user.emails,
          [],
          user.samlIdentifiers || []
        )
      })
      callback(null, users)
    })
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
    this.getUserByAnyEmail(newEmail, function (error, user) {
      if (user) {
        return callback(new Errors.EmailExistsError())
      }
      callback(error)
    })
  },
}

const decorateFullEmails = (
  defaultEmail,
  emailsData,
  affiliationsData,
  samlIdentifiers
) => {
  emailsData.forEach(function (emailData) {
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
        cached_confirmed_at: cachedConfirmedAt,
        cached_reconfirmed_at: cachedReconfirmedAt,
        past_reconfirm_date: cachedPastReconfirmDate,
        entitlement: cachedEntitlement,
        portal,
      } = affiliation
      const lastDayToReconfirm = _lastDayToReconfirm(emailData, institution)
      let { last_day_to_reconfirm: cachedLastDayToReconfirm } = affiliation
      if (institution.ssoEnabled && !emailData.samlProviderId) {
        // only SSO linked emails are reconfirmed at SSO institutions
        cachedLastDayToReconfirm = undefined
      }
      const pastReconfirmDate = _pastReconfirmDate(lastDayToReconfirm)
      const inReconfirmNotificationPeriod = _emailInReconfirmNotificationPeriod(
        cachedLastDayToReconfirm
      )
      emailData.affiliation = {
        institution,
        inferred,
        inReconfirmNotificationPeriod,
        lastDayToReconfirm,
        cachedConfirmedAt,
        cachedLastDayToReconfirm,
        cachedReconfirmedAt,
        cachedEntitlement,
        cachedPastReconfirmDate,
        pastReconfirmDate,
        role,
        department,
        licence,
        portal,
      }
    }

    if (emailData.samlProviderId) {
      emailData.samlIdentifier = samlIdentifiers.find(
        samlIdentifier => samlIdentifier.providerId === emailData.samlProviderId
      )
    }

    emailData.emailHasInstitutionLicence =
      InstitutionsHelper.emailHasLicence(emailData)

    const lastConfirmedAtStr = emailData.reconfirmedAt || emailData.confirmedAt
    emailData.lastConfirmedAt = lastConfirmedAtStr
      ? moment(lastConfirmedAtStr).toDate()
      : null
  })

  return emailsData
}

UserGetter.promises = promisifyAll(UserGetter, {
  without: ['getSsoUsersAtInstitution', 'getUserFullEmails'],
})
UserGetter.promises.getUserFullEmails = getUserFullEmails
UserGetter.promises.getSsoUsersAtInstitution = getSsoUsersAtInstitution

module.exports = UserGetter

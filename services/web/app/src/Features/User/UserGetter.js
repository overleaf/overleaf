const { db } = require('../../infrastructure/mongodb')
const metrics = require('@overleaf/metrics')
const logger = require('logger-sharelatex')
const { promisifyAll } = require('../../util/promises')
const { getUserAffiliations } = require('../Institutions/InstitutionsAPI')
const InstitutionsHelper = require('../Institutions/InstitutionsHelper')
const Errors = require('../Errors/Errors')
const Features = require('../../infrastructure/Features')
const { normalizeQuery, normalizeMultiQuery } = require('../Helpers/Mongo')

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

  getUserFullEmails(userId, callback) {
    this.getUser(userId, { email: 1, emails: 1, samlIdentifiers: 1 }, function(
      error,
      user
    ) {
      if (error) {
        return callback(error)
      }
      if (!user) {
        return callback(new Error('User not Found'))
      }

      if (!Features.hasFeature('affiliations')) {
        return callback(
          null,
          decorateFullEmails(user.email, user.emails, [], [])
        )
      }

      getUserAffiliations(userId, function(error, affiliationsData) {
        if (error) {
          return callback(error)
        }
        callback(
          null,
          decorateFullEmails(
            user.email,
            user.emails || [],
            affiliationsData,
            user.samlIdentifiers || []
          )
        )
      })
    })
  },

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
) =>
  emailsData.map(function(emailData) {
    emailData.default = emailData.email === defaultEmail

    const affiliation = affiliationsData.find(
      aff => aff.email === emailData.email
    )
    if (affiliation) {
      const { institution, inferred, role, department, licence } = affiliation
      emailData.affiliation = {
        institution,
        inferred,
        role,
        department,
        licence
      }
    } else {
      emailsData.affiliation = null
    }

    if (emailData.samlProviderId) {
      emailData.samlIdentifier = samlIdentifiers.find(
        samlIdentifier => samlIdentifier.providerId === emailData.samlProviderId
      )
    } else {
      emailsData.samlIdentifier = null
    }

    emailData.emailHasInstitutionLicence = InstitutionsHelper.emailHasLicence(
      emailData
    )

    return emailData
  })
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

UserGetter.promises = promisifyAll(UserGetter)
module.exports = UserGetter

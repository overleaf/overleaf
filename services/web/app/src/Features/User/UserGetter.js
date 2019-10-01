const mongojs = require('../../infrastructure/mongojs')
const metrics = require('metrics-sharelatex')
const logger = require('logger-sharelatex')
const { db } = mongojs
const { ObjectId } = mongojs
const { promisifyAll } = require('../../util/promises')
const { getUserAffiliations } = require('../Institutions/InstitutionsAPI')
const Errors = require('../Errors/Errors')
const Features = require('../../infrastructure/Features')

const UserGetter = {
  getUser(query, projection, callback) {
    if (!query) {
      return callback(new Error('no query provided'))
    }
    if (arguments.length === 2) {
      callback = projection
      projection = {}
    }
    if (typeof query === 'string') {
      try {
        query = { _id: ObjectId(query) }
      } catch (e) {
        return callback(null, null)
      }
    } else if (query instanceof ObjectId) {
      query = { _id: query }
    }

    db.users.findOne(query, projection, callback)
  },

  getUserEmail(userId, callback) {
    this.getUser(userId, { email: 1 }, (error, user) =>
      callback(error, user && user.email)
    )
  },

  getUserFullEmails(userId, callback) {
    this.getUser(userId, { email: 1, emails: 1 }, function(error, user) {
      if (error) {
        return callback(error)
      }
      if (!user) {
        return callback(new Error('User not Found'))
      }

      if (!Features.hasFeature('affiliations')) {
        return callback(null, decorateFullEmails(user.email, user.emails, []))
      }

      getUserAffiliations(userId, function(error, affiliationsData) {
        if (error) {
          return callback(error)
        }
        callback(
          null,
          decorateFullEmails(user.email, user.emails || [], affiliationsData)
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
    db.users.findOne({ email }, projection, callback)
  },

  getUserByAnyEmail(email, projection, callback) {
    email = email.trim()
    if (arguments.length === 2) {
      callback = projection
      projection = {}
    }
    // $exists: true MUST be set to use the partial index
    const query = { emails: { $exists: true }, 'emails.email': email }
    db.users.findOne(query, projection, (error, user) => {
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
    // $exists: true MUST be set to use the partial index
    const query = {
      emails: {
        $exists: true,
        $elemMatch: { email: { $in: emails }, confirmedAt: { $exists: true } }
      }
    }
    db.users.find(query, projection, callback)
  },

  getUsersByV1Ids(v1Ids, projection, callback) {
    if (arguments.length === 2) {
      callback = projection
      projection = {}
    }
    const query = { 'overleaf.id': { $in: v1Ids } }
    db.users.find(query, projection, callback)
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
    db.users.find(query, projection, callback)
  },

  getUsers(userIds, projection, callback) {
    try {
      userIds = userIds.map(u => ObjectId(u.toString()))
    } catch (error) {
      return callback(error)
    }

    db.users.find({ _id: { $in: userIds } }, projection, callback)
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

var decorateFullEmails = (defaultEmail, emailsData, affiliationsData) =>
  emailsData.map(function(emailData) {
    emailData.default = emailData.email === defaultEmail

    const affiliation = affiliationsData.find(
      aff => aff.email === emailData.email
    )
    if (affiliation) {
      const { institution, inferred, role, department } = affiliation
      emailData.affiliation = { institution, inferred, role, department }
    } else {
      emailsData.affiliation = null
    }

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

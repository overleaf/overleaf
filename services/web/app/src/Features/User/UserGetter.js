/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
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
    if (callback == null) {
      callback = function(error, user) {}
    }
    if (query == null) {
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

    return db.users.findOne(query, projection, callback)
  },

  getUserEmail(userId, callback) {
    if (callback == null) {
      callback = function(error, email) {}
    }
    return this.getUser(userId, { email: 1 }, (error, user) =>
      callback(error, user != null ? user.email : undefined)
    )
  },

  getUserFullEmails(userId, callback) {
    if (callback == null) {
      callback = function(error, emails) {}
    }
    return this.getUser(userId, { email: 1, emails: 1 }, function(error, user) {
      if (error != null) {
        return callback(error)
      }
      if (!user) {
        return callback(new Error('User not Found'))
      }

      if (!Features.hasFeature('affiliations')) {
        return callback(null, decorateFullEmails(user.email, user.emails, []))
      }

      return getUserAffiliations(userId, function(error, affiliationsData) {
        if (error != null) {
          return callback(error)
        }
        return callback(
          null,
          decorateFullEmails(user.email, user.emails || [], affiliationsData)
        )
      })
    })
  },

  getUserByMainEmail(email, projection, callback) {
    if (callback == null) {
      callback = function(error, user) {}
    }
    email = email.trim()
    if (arguments.length === 2) {
      callback = projection
      projection = {}
    }
    return db.users.findOne({ email }, projection, callback)
  },

  getUserByAnyEmail(email, projection, callback) {
    if (callback == null) {
      callback = function(error, user) {}
    }
    email = email.trim()
    if (arguments.length === 2) {
      callback = projection
      projection = {}
    }
    // $exists: true MUST be set to use the partial index
    const query = { emails: { $exists: true }, 'emails.email': email }
    return db.users.findOne(query, projection, (error, user) => {
      if (error != null || user != null) {
        return callback(error, user)
      }

      // While multiple emails are being rolled out, check for the main email as
      // well
      return this.getUserByMainEmail(email, projection, callback)
    })
  },

  getUsersByAnyConfirmedEmail(emails, projection, callback) {
    if (callback == null) {
      callback = function(error, user) {}
    }
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
    return db.users.find(query, projection, (error, users) => {
      return callback(error, users)
    })
  },

  getUsersByV1Ids(v1Ids, projection, callback) {
    if (callback == null) {
      callback = function(error, user) {}
    }
    if (arguments.length === 2) {
      callback = projection
      projection = {}
    }
    const query = { 'overleaf.id': { $in: v1Ids } }
    return db.users.find(query, projection, (error, users) => {
      return callback(error, users)
    })
  },

  getUsersByHostname(hostname, projection, callback) {
    if (callback == null) {
      callback = function(error, users) {}
    }
    const reversedHostname = hostname
      .trim()
      .split('')
      .reverse()
      .join('')
    const query = {
      emails: { $exists: true },
      'emails.reversedHostname': reversedHostname
    }
    return db.users.find(query, projection, callback)
  },

  getUsers(user_ids, projection, callback) {
    if (callback == null) {
      callback = function(error, users) {}
    }
    try {
      user_ids = user_ids.map(u => ObjectId(u.toString()))
    } catch (error1) {
      const error = error1
      return callback(error)
    }

    return db.users.find({ _id: { $in: user_ids } }, projection, callback)
  },

  getUserOrUserStubById(user_id, projection, callback) {
    let query
    if (callback == null) {
      callback = function(error, user, isStub) {}
    }
    try {
      query = { _id: ObjectId(user_id.toString()) }
    } catch (e) {
      return callback(new Error(e))
    }
    return db.users.findOne(query, projection, function(error, user) {
      if (error != null) {
        return callback(error)
      }
      if (user != null) {
        return callback(null, user, false)
      }
      return db.userstubs.findOne(query, projection, function(error, user) {
        if (error) {
          return callback(error)
        }
        if (user == null) {
          return callback()
        }
        return callback(null, user, true)
      })
    })
  },

  // check for duplicate email address. This is also enforced at the DB level
  ensureUniqueEmailAddress(newEmail, callback) {
    return this.getUserByAnyEmail(newEmail, function(error, user) {
      if (user != null) {
        return callback(new Errors.EmailExistsError())
      }
      return callback(error)
    })
  }
}

var decorateFullEmails = (defaultEmail, emailsData, affiliationsData) =>
  emailsData.map(function(emailData) {
    emailData.default = emailData.email === defaultEmail

    const affiliation = affiliationsData.find(
      aff => aff.email === emailData.email
    )
    if (affiliation != null) {
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
  'getUserOrUserStubById',
  'ensureUniqueEmailAddress'
].map(method =>
  metrics.timeAsyncMethod(UserGetter, method, 'mongo.UserGetter', logger)
)

UserGetter.promises = promisifyAll(UserGetter)
module.exports = UserGetter

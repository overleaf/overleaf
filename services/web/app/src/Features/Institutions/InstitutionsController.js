/* eslint-disable
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let InstitutionsController
const logger = require('logger-sharelatex')
const UserGetter = require('../User/UserGetter')
const { addAffiliation } = require('../Institutions/InstitutionsAPI')
const FeaturesUpdater = require('../Subscription/FeaturesUpdater')
const async = require('async')
const ASYNC_AFFILIATIONS_LIMIT = 10

module.exports = InstitutionsController = {
  confirmDomain(req, res, next) {
    const { hostname } = req.body
    return affiliateUsers(hostname, function(error) {
      if (error != null) {
        return next(error)
      }
      return res.sendStatus(200)
    })
  }
}

var affiliateUsers = function(hostname, callback) {
  if (callback == null) {
    callback = function(error) {}
  }
  const reversedHostname = hostname
    .trim()
    .split('')
    .reverse()
    .join('')
  return UserGetter.getUsersByHostname(
    hostname,
    { _id: 1, emails: 1 },
    function(error, users) {
      if (error != null) {
        logger.warn({ error }, 'problem fetching users by hostname')
        return callback(error)
      }

      return async.mapLimit(
        users,
        ASYNC_AFFILIATIONS_LIMIT,
        (user, innerCallback) =>
          affiliateUserByReversedHostname(
            user,
            reversedHostname,
            innerCallback
          ),
        callback
      )
    }
  )
}

var affiliateUserByReversedHostname = function(
  user,
  reversedHostname,
  callback
) {
  const matchingEmails = user.emails.filter(
    email => email.reversedHostname === reversedHostname
  )
  return async.mapSeries(
    matchingEmails,
    (email, innerCallback) =>
      addAffiliation(
        user._id,
        email.email,
        { confirmedAt: email.confirmedAt },
        error => {
          if (error != null) {
            logger.warn(
              { error },
              'problem adding affiliation while confirming hostname'
            )
            return innerCallback(error)
          }
          return FeaturesUpdater.refreshFeatures(user._id, innerCallback)
        }
      ),
    callback
  )
}

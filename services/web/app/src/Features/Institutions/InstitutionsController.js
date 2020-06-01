const logger = require('logger-sharelatex')
const UserGetter = require('../User/UserGetter')
const { addAffiliation } = require('../Institutions/InstitutionsAPI')
const FeaturesUpdater = require('../Subscription/FeaturesUpdater')
const async = require('async')
const ASYNC_AFFILIATIONS_LIMIT = 10

module.exports = {
  confirmDomain(req, res, next) {
    const { hostname } = req.body
    affiliateUsers(hostname, function(error) {
      if (error) {
        return next(error)
      }
      res.sendStatus(200)
    })
  }
}

var affiliateUsers = function(hostname, callback) {
  const reversedHostname = hostname
    .trim()
    .split('')
    .reverse()
    .join('')
  UserGetter.getUsersByHostname(hostname, { _id: 1, emails: 1 }, function(
    error,
    users
  ) {
    if (error) {
      logger.warn({ error }, 'problem fetching users by hostname')
      return callback(error)
    }

    async.mapLimit(
      users,
      ASYNC_AFFILIATIONS_LIMIT,
      (user, innerCallback) =>
        affiliateUserByReversedHostname(user, reversedHostname, innerCallback),
      callback
    )
  })
}

var affiliateUserByReversedHostname = function(
  user,
  reversedHostname,
  callback
) {
  const matchingEmails = user.emails.filter(
    email => email.reversedHostname === reversedHostname
  )
  async.mapSeries(
    matchingEmails,
    (email, innerCallback) =>
      addAffiliation(
        user._id,
        email.email,
        { confirmedAt: email.confirmedAt },
        error => {
          if (error) {
            logger.warn(
              { error },
              'problem adding affiliation while confirming hostname'
            )
            return innerCallback(error)
          }
          FeaturesUpdater.refreshFeatures(user._id, innerCallback)
        }
      ),
    callback
  )
}

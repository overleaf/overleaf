const AnalyticsManager = require('./AnalyticsManager')
const Errors = require('../Errors/Errors')
const AuthenticationController = require('../Authentication/AuthenticationController')
const InstitutionsAPI = require('../Institutions/InstitutionsAPI')
const GeoIpLookup = require('../../infrastructure/GeoIpLookup')
const Features = require('../../infrastructure/Features')

module.exports = {
  updateEditingSession(req, res, next) {
    if (!Features.hasFeature('analytics')) {
      return res.send(204)
    }
    const userId = AuthenticationController.getLoggedInUserId(req)
    const { projectId } = req.params
    let countryCode = null

    if (userId) {
      GeoIpLookup.getDetails(req.ip, function(err, geoDetails) {
        if (!err && geoDetails && geoDetails.country_code) {
          countryCode = geoDetails.country_code
        }
        AnalyticsManager.updateEditingSession(
          userId,
          projectId,
          countryCode,
          error => respondWith(error, res, next)
        )
      })
    } else {
      res.send(204)
    }
  },

  recordEvent(req, res, next) {
    if (!Features.hasFeature('analytics')) {
      return res.send(204)
    }
    const userId =
      AuthenticationController.getLoggedInUserId(req) || req.sessionID
    AnalyticsManager.recordEvent(userId, req.params.event, req.body, error =>
      respondWith(error, res, next)
    )
  },

  licences(req, res, next) {
    InstitutionsAPI.getInstitutionLicences(
      req.query.resource_id,
      req.query.start_date,
      req.query.end_date,
      req.query.lag,
      function(error, licences) {
        if (error) {
          return next(error)
        }
        res.send(licences)
      }
    )
  },

  newLicences(req, res, next) {
    InstitutionsAPI.getInstitutionNewLicences(
      req.query.resource_id,
      req.query.start_date,
      req.query.end_date,
      req.query.lag,
      function(error, licences) {
        if (error) {
          return next(error)
        }
        res.send(licences)
      }
    )
  }
}

var respondWith = function(error, res, next) {
  if (error instanceof Errors.ServiceNotConfiguredError) {
    // ignore, no-op
    res.sendStatus(204)
  } else if (error) {
    next(error)
  } else {
    res.sendStatus(204)
  }
}

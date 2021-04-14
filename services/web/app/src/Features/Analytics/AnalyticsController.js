const metrics = require('@overleaf/metrics')
const AnalyticsManager = require('./AnalyticsManager')
const AuthenticationController = require('../Authentication/AuthenticationController')
const InstitutionsAPI = require('../Institutions/InstitutionsAPI')
const GeoIpLookup = require('../../infrastructure/GeoIpLookup')
const Features = require('../../infrastructure/Features')

module.exports = {
  updateEditingSession(req, res, next) {
    if (!Features.hasFeature('analytics')) {
      return res.sendStatus(202)
    }
    const userId = AuthenticationController.getLoggedInUserId(req)
    const { projectId } = req.params
    let countryCode = null

    if (userId) {
      GeoIpLookup.getDetails(req.ip, function (err, geoDetails) {
        if (err) {
          metrics.inc('analytics_geo_ip_lookup_errors')
        } else if (geoDetails && geoDetails.country_code) {
          countryCode = geoDetails.country_code
        }
        AnalyticsManager.updateEditingSession(userId, projectId, countryCode)
      })
    }
    res.sendStatus(202)
  },

  recordEvent(req, res, next) {
    if (!Features.hasFeature('analytics')) {
      return res.sendStatus(202)
    }
    const userId =
      AuthenticationController.getLoggedInUserId(req) || req.sessionID
    AnalyticsManager.recordEvent(userId, req.params.event, req.body)
    res.sendStatus(202)
  },

  licences(req, res, next) {
    InstitutionsAPI.getInstitutionLicences(
      req.query.resource_id,
      req.query.start_date,
      req.query.end_date,
      req.query.lag,
      function (error, licences) {
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
      function (error, licences) {
        if (error) {
          return next(error)
        }
        res.send(licences)
      }
    )
  }
}

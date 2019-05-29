/* eslint-disable
    camelcase,
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
let AnalyticsController
const AnalyticsManager = require('./AnalyticsManager')
const Errors = require('../Errors/Errors')
const AuthenticationController = require('../Authentication/AuthenticationController')
const InstitutionsAPI = require('../Institutions/InstitutionsAPI')
const GeoIpLookup = require('../../infrastructure/GeoIpLookup')

module.exports = AnalyticsController = {
  updateEditingSession(req, res, next) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    const { projectId } = req.params
    let countryCode = null

    if (userId != null) {
      return GeoIpLookup.getDetails(req.ip, function(err, geoDetails) {
        if (
          (geoDetails != null ? geoDetails.country_code : undefined) != null &&
          geoDetails.country_code !== ''
        ) {
          countryCode = geoDetails.country_code
        }
        return AnalyticsManager.updateEditingSession(
          userId,
          projectId,
          countryCode,
          error => respondWith(error, res, next)
        )
      })
    } else {
      return res.send(204)
    }
  },

  recordEvent(req, res, next) {
    const user_id =
      AuthenticationController.getLoggedInUserId(req) || req.sessionID
    return AnalyticsManager.recordEvent(
      user_id,
      req.params.event,
      req.body,
      error => respondWith(error, res, next)
    )
  },

  licences(req, res, next) {
    const { resource_id, start_date, end_date, lag } = req.query
    return InstitutionsAPI.getInstitutionLicences(
      resource_id,
      start_date,
      end_date,
      lag,
      function(error, licences) {
        if (error != null) {
          return next(error)
        } else {
          return res.send(licences)
        }
      }
    )
  }
}

var respondWith = function(error, res, next) {
  if (error instanceof Errors.ServiceNotConfiguredError) {
    // ignore, no-op
    return res.send(204)
  } else if (error != null) {
    return next(error)
  } else {
    return res.send(204)
  }
}

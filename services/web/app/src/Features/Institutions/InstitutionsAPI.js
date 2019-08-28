/* eslint-disable
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const settings = require('settings-sharelatex')
const request = require('request')
const { promisifyAll } = require('../../util/promises')
const NotificationsBuilder = require('../Notifications/NotificationsBuilder')

const InstitutionsAPI = {
  getInstitutionAffiliations(institutionId, callback) {
    if (callback == null) {
      callback = function(error, body) {}
    }
    return makeAffiliationRequest(
      {
        method: 'GET',
        path: `/api/v2/institutions/${institutionId.toString()}/affiliations`,
        defaultErrorMessage: "Couldn't get institution affiliations"
      },
      (error, body) => callback(error, body || [])
    )
  },

  getInstitutionLicences(institutionId, startDate, endDate, lag, callback) {
    if (callback == null) {
      callback = function(error, body) {}
    }
    return makeAffiliationRequest(
      {
        method: 'GET',
        path: `/api/v2/institutions/${institutionId.toString()}/institution_licences`,
        body: { start_date: startDate, end_date: endDate, lag },
        defaultErrorMessage: "Couldn't get institution licences"
      },
      callback
    )
  },

  getInstitutionNewLicences(institutionId, startDate, endDate, lag, callback) {
    if (callback == null) {
      callback = function(error, body) {}
    }
    return makeAffiliationRequest(
      {
        method: 'GET',
        path: `/api/v2/institutions/${institutionId.toString()}/new_institution_licences`,
        body: { start_date: startDate, end_date: endDate, lag },
        defaultErrorMessage: "Couldn't get institution new licences"
      },
      callback
    )
  },

  getUserAffiliations(userId, callback) {
    if (callback == null) {
      callback = function(error, body) {}
    }
    return makeAffiliationRequest(
      {
        method: 'GET',
        path: `/api/v2/users/${userId.toString()}/affiliations`,
        defaultErrorMessage: "Couldn't get user affiliations"
      },
      (error, body) => callback(error, body || [])
    )
  },

  addAffiliation(userId, email, affiliationOptions, callback) {
    if (callback == null) {
      // affiliationOptions is optional
      callback = affiliationOptions
      affiliationOptions = {}
    }

    const { university, department, role, confirmedAt } = affiliationOptions
    return makeAffiliationRequest(
      {
        method: 'POST',
        path: `/api/v2/users/${userId.toString()}/affiliations`,
        body: { email, university, department, role, confirmedAt },
        defaultErrorMessage: "Couldn't create affiliation"
      },
      function(error, body) {
        if (error) {
          return callback(error, body)
        }
        // have notifications delete any ip matcher notifications for this university
        return NotificationsBuilder.ipMatcherAffiliation(userId).read(
          university != null ? university.id : undefined,
          function(err) {
            if (err) {
              // log and ignore error
              logger.err(
                { err },
                'Something went wrong marking ip notifications read'
              )
            }
            return callback(null, body)
          }
        )
      }
    )
  },

  removeAffiliation(userId, email, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return makeAffiliationRequest(
      {
        method: 'POST',
        path: `/api/v2/users/${userId.toString()}/affiliations/remove`,
        body: { email },
        extraSuccessStatusCodes: [404], // `Not Found` responses are considered successful
        defaultErrorMessage: "Couldn't remove affiliation"
      },
      callback
    )
  },

  endorseAffiliation(userId, email, role, department, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return makeAffiliationRequest(
      {
        method: 'POST',
        path: `/api/v2/users/${userId.toString()}/affiliations/endorse`,
        body: { email, role, department },
        defaultErrorMessage: "Couldn't endorse affiliation"
      },
      callback
    )
  },

  deleteAffiliations(userId, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return makeAffiliationRequest(
      {
        method: 'DELETE',
        path: `/api/v2/users/${userId.toString()}/affiliations`,
        defaultErrorMessage: "Couldn't delete affiliations"
      },
      callback
    )
  }
}

var makeAffiliationRequest = function(requestOptions, callback) {
  if (callback == null) {
    callback = function(error) {}
  }
  if (!settings.apis.v1.url) {
    return callback(null)
  } // service is not configured
  if (!requestOptions.extraSuccessStatusCodes) {
    requestOptions.extraSuccessStatusCodes = []
  }
  return request(
    {
      method: requestOptions.method,
      url: `${settings.apis.v1.url}${requestOptions.path}`,
      body: requestOptions.body,
      auth: { user: settings.apis.v1.user, pass: settings.apis.v1.pass },
      json: true,
      timeout: 20 * 1000
    },
    function(error, response, body) {
      if (error != null) {
        return callback(error)
      }
      let isSuccess = response.statusCode >= 200 && response.statusCode < 300
      if (!isSuccess) {
        isSuccess = Array.from(requestOptions.extraSuccessStatusCodes).includes(
          response.statusCode
        )
      }
      if (!isSuccess) {
        let errorMessage
        if (body != null ? body.errors : undefined) {
          errorMessage = `${response.statusCode}: ${body.errors}`
        } else {
          errorMessage = `${requestOptions.defaultErrorMessage}: ${
            response.statusCode
          }`
        }

        logger.warn(
          { path: requestOptions.path, body: requestOptions.body },
          errorMessage
        )
        return callback(new Error(errorMessage))
      }

      return callback(null, body)
    }
  )
}
;[
  'getInstitutionAffiliations',
  'getUserAffiliations',
  'addAffiliation',
  'removeAffiliation'
].map(method =>
  metrics.timeAsyncMethod(
    InstitutionsAPI,
    method,
    'mongo.InstitutionsAPI',
    logger
  )
)

InstitutionsAPI.promises = promisifyAll(InstitutionsAPI)
module.exports = InstitutionsAPI

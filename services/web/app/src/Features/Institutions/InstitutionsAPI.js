const OError = require('@overleaf/o-error')
const logger = require('@overleaf/logger')
const metrics = require('@overleaf/metrics')
const settings = require('@overleaf/settings')
const request = require('requestretry')
const { promisifyAll } = require('../../util/promises')
const NotificationsBuilder = require('../Notifications/NotificationsBuilder')
const {
  V1ConnectionError,
  InvalidInstitutionalEmailError,
} = require('../Errors/Errors')

const InstitutionsAPI = {
  getInstitutionAffiliations(institutionId, callback) {
    makeAffiliationRequest(
      {
        method: 'GET',
        path: `/api/v2/institutions/${institutionId.toString()}/affiliations`,
        defaultErrorMessage: "Couldn't get institution affiliations",
      },
      (error, body) => callback(error, body || [])
    )
  },

  getInstitutionAffiliationsCounts(institutionId, callback) {
    makeAffiliationRequest(
      {
        method: 'GET',
        path: `/api/v2/institutions/${institutionId.toString()}/affiliations_counts`,
        defaultErrorMessage: "Couldn't get institution counts",
      },
      (error, body) => callback(error, body || [])
    )
  },

  getLicencesForAnalytics(lag, queryDate, callback) {
    makeAffiliationRequest(
      {
        method: 'GET',
        path: `/api/v2/institutions/institutions_licences`,
        body: { query_date: queryDate, lag },
        defaultErrorMessage: 'Could not get institutions licences',
      },
      callback
    )
  },

  getUserAffiliations(userId, callback) {
    makeAffiliationRequest(
      {
        method: 'GET',
        path: `/api/v2/users/${userId.toString()}/affiliations`,
        defaultErrorMessage: "Couldn't get user affiliations",
      },
      (error, body) => callback(error, body || [])
    )
  },

  getUsersNeedingReconfirmationsLapsedProcessed(callback) {
    makeAffiliationRequest(
      {
        method: 'GET',
        path: '/api/v2/institutions/need_reconfirmation_lapsed_processed',
        defaultErrorMessage:
          'Could not get users that need reconfirmations lapsed processed',
      },
      (error, body) => callback(error, body || [])
    )
  },

  addAffiliation(userId, email, affiliationOptions, callback) {
    if (!callback) {
      // affiliationOptions is optional
      callback = affiliationOptions
      affiliationOptions = {}
    }

    const {
      university,
      department,
      role,
      confirmedAt,
      entitlement,
      rejectIfBlocklisted,
    } = affiliationOptions
    makeAffiliationRequest(
      {
        method: 'POST',
        path: `/api/v2/users/${userId.toString()}/affiliations`,
        body: {
          email,
          university,
          department,
          role,
          confirmedAt,
          entitlement,
          rejectIfBlocklisted,
        },
        defaultErrorMessage: "Couldn't create affiliation",
      },
      function (error, body) {
        if (error) {
          if (error.info && error.info.statusCode === 422) {
            return callback(
              new InvalidInstitutionalEmailError(error.message).withCause(error)
            )
          }
          return callback(error)
        }
        if (!university) {
          return callback(null, body)
        }

        // have notifications delete any ip matcher notifications for this university
        NotificationsBuilder.ipMatcherAffiliation(userId).read(
          university.id,
          function (err) {
            if (err) {
              // log and ignore error
              logger.err(
                { err },
                'Something went wrong marking ip notifications read'
              )
            }
            callback(null, body)
          }
        )
      }
    )
  },

  removeAffiliation(userId, email, callback) {
    makeAffiliationRequest(
      {
        method: 'POST',
        path: `/api/v2/users/${userId.toString()}/affiliations/remove`,
        body: { email },
        extraSuccessStatusCodes: [404], // `Not Found` responses are considered successful
        defaultErrorMessage: "Couldn't remove affiliation",
      },
      callback
    )
  },

  endorseAffiliation(userId, email, role, department, callback) {
    makeAffiliationRequest(
      {
        method: 'POST',
        path: `/api/v2/users/${userId.toString()}/affiliations/endorse`,
        body: { email, role, department },
        defaultErrorMessage: "Couldn't endorse affiliation",
      },
      callback
    )
  },

  deleteAffiliations(userId, callback) {
    makeAffiliationRequest(
      {
        method: 'DELETE',
        path: `/api/v2/users/${userId.toString()}/affiliations`,
        defaultErrorMessage: "Couldn't delete affiliations",
      },
      callback
    )
  },

  addEntitlement(userId, email, callback) {
    makeAffiliationRequest(
      {
        method: 'POST',
        path: `/api/v2/users/${userId}/affiliations/add_entitlement`,
        body: { email },
        defaultErrorMessage: "Couldn't add entitlement",
      },
      callback
    )
  },

  removeEntitlement(userId, email, callback) {
    makeAffiliationRequest(
      {
        method: 'POST',
        path: `/api/v2/users/${userId}/affiliations/remove_entitlement`,
        body: { email },
        defaultErrorMessage: "Couldn't remove entitlement",
        extraSuccessStatusCodes: [404],
      },
      callback
    )
  },

  sendUsersWithReconfirmationsLapsedProcessed(users, callback) {
    makeAffiliationRequest(
      {
        method: 'POST',
        path: '/api/v2/institutions/reconfirmation_lapsed_processed',
        body: { users },
        defaultErrorMessage:
          'Could not update reconfirmation_lapsed_processed_at',
      },
      (error, body) => callback(error, body || [])
    )
  },
}

function makeAffiliationRequest(options, callback) {
  if (!settings.apis.v1.url) {
    return callback(null)
  } // service is not configured
  if (!options.extraSuccessStatusCodes) {
    options.extraSuccessStatusCodes = []
  }
  const requestOptions = {
    method: options.method,
    url: `${settings.apis.v1.url}${options.path}`,
    body: options.body,
    auth: { user: settings.apis.v1.user, pass: settings.apis.v1.pass },
    json: true,
    timeout: settings.apis.v1.timeout,
  }
  if (options.method === 'GET') {
    requestOptions.maxAttempts = 3
    requestOptions.retryDelay = 500
  } else {
    requestOptions.maxAttempts = 0
  }
  request(requestOptions, function (error, response, body) {
    if (error) {
      return callback(
        new V1ConnectionError('error getting affiliations from v1').withCause(
          error
        )
      )
    }
    if (response && response.statusCode >= 500) {
      return callback(
        new V1ConnectionError({
          message: 'error getting affiliations from v1',
          info: {
            status: response.statusCode,
            body: body,
          },
        })
      )
    }
    let isSuccess = response.statusCode >= 200 && response.statusCode < 300
    if (!isSuccess) {
      isSuccess = options.extraSuccessStatusCodes.includes(response.statusCode)
    }
    if (!isSuccess) {
      let errorMessage
      if (body && body.errors) {
        errorMessage = `${response.statusCode}: ${body.errors}`
      } else {
        errorMessage = `${options.defaultErrorMessage}: ${response.statusCode}`
      }

      logger.warn({ path: options.path, body: options.body }, errorMessage)
      return callback(
        new OError(errorMessage, { statusCode: response.statusCode })
      )
    }

    callback(null, body)
  })
}
;[
  'getInstitutionAffiliations',
  'getUserAffiliations',
  'addAffiliation',
  'removeAffiliation',
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

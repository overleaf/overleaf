import OError from '@overleaf/o-error'
import logger from '@overleaf/logger'
import settings from '@overleaf/settings'
import { promiseMapWithLimit, callbackifyAll } from '@overleaf/promise-utils'
import NotificationsBuilder from '../Notifications/NotificationsBuilder.mjs'
import {
  V1ConnectionError,
  InvalidInstitutionalEmailError,
} from '../Errors/Errors.js'
import { fetchJson, fetchNothing } from '@overleaf/fetch-utils'
import Modules from '../../infrastructure/Modules.mjs'

function _makeRequestOptions(options) {
  const requestOptions = {
    method: options.method,
    basicAuth: { user: settings.apis.v1.user, password: settings.apis.v1.pass },
    signal: AbortSignal.timeout(options.timeout ?? settings.apis.v1.timeout),
  }

  if (options.body) {
    requestOptions.json = options.body
  }

  return requestOptions
}

function _responseErrorHandling(options, error) {
  const status = error.response?.status

  if (status >= 500) {
    throw new V1ConnectionError({
      message: 'error getting affiliations from v1',
      info: {
        status,
        body: error.body,
      },
    })
  }

  let errorBody

  try {
    if (error.body) {
      errorBody = JSON.parse(error.body)
    }
  } catch (e) {}

  let errorMessage
  if (errorBody?.errors) {
    errorMessage = `${status}: ${errorBody.errors}`
  } else {
    errorMessage = `${options.defaultErrorMessage}: ${status}`
  }

  throw new OError(errorMessage, { status })
}

async function _affiliationRequestFetchJson(options) {
  if (!settings.apis.v1.url) {
    return
  } // service is not configured

  const url = `${settings.apis.v1.url}${options.path}`

  const requestOptions = _makeRequestOptions(options)

  try {
    return await fetchJson(url, requestOptions)
  } catch (error) {
    _responseErrorHandling(options, error)
  }
}

async function _affiliationRequestFetchNothing(options) {
  if (!settings.apis.v1.url) {
    return
  } // service is not configured

  const url = `${settings.apis.v1.url}${options.path}`

  const requestOptions = _makeRequestOptions(options)

  try {
    await fetchNothing(url, requestOptions)
  } catch (error) {
    _responseErrorHandling(options, error)
  }
}

async function _affiliationRequestFetchNothing404Ok(options) {
  try {
    await _affiliationRequestFetchNothing(options)
  } catch (error) {
    const status = error.info?.status
    if (status !== 404) {
      throw error
    }
  }
}

async function getInstitutionAffiliations(institutionId) {
  const json = await _affiliationRequestFetchJson({
    method: 'GET',
    path: `/api/v2/institutions/${institutionId.toString()}/affiliations`,
    defaultErrorMessage: "Couldn't get institution affiliations",
  })
  return json || []
}

async function getConfirmedInstitutionAffiliations(institutionId) {
  const json = await _affiliationRequestFetchJson({
    method: 'GET',
    path: `/api/v2/institutions/${institutionId.toString()}/confirmed_affiliations`,
    defaultErrorMessage: "Couldn't get institution affiliations",
  })
  return json || []
}

async function getInstitutionAffiliationsCounts(institutionId) {
  const json = await _affiliationRequestFetchJson({
    method: 'GET',
    path: `/api/v2/institutions/${institutionId.toString()}/affiliations_counts`,
    defaultErrorMessage: "Couldn't get institution counts",
  })
  return json || []
}

async function getLicencesForAnalytics(lag, queryDate) {
  const json = await _affiliationRequestFetchJson({
    method: 'GET',
    path: `/api/v2/institutions/institutions_licences`,
    body: { query_date: queryDate, lag },
    defaultErrorMessage: 'Could not get institutions licences',
    timeout: 60_000,
  })
  return json
}

async function getUserAffiliations(userId) {
  const json = await _affiliationRequestFetchJson({
    method: 'GET',
    path: `/api/v2/users/${userId.toString()}/affiliations`,
    defaultErrorMessage: "Couldn't get user affiliations",
  })

  const affiliations = []

  if (json?.length > 0) {
    const concurrencyLimit = 10
    await promiseMapWithLimit(concurrencyLimit, json, async affiliation => {
      if (affiliation.institution.confirmed) {
        // only check groups if domain is confirmed
        const group = (
          await Modules.promises.hooks.fire(
            'getGroupWithDomainCaptureByV1Id',
            affiliation.institution.id
          )
        )?.[0]

        if (group) {
          affiliation.group = {
            _id: group._id,
            managedUsersEnabled: Boolean(group.managedUsersEnabled),
            domainCaptureEnabled: Boolean(group.domainCaptureEnabled),
          }
        }
      }
      affiliations.push(affiliation)
    })
  }
  return affiliations
}

async function getUsersNeedingReconfirmationsLapsedProcessed() {
  return await _affiliationRequestFetchJson({
    method: 'GET',
    path: '/api/v2/institutions/need_reconfirmation_lapsed_processed',
    defaultErrorMessage:
      'Could not get users that need reconfirmations lapsed processed',
  })
}

async function addAffiliation(userId, email, affiliationOptions) {
  const {
    university,
    department,
    role,
    confirmedAt,
    entitlement,
    rejectIfBlocklisted,
  } = affiliationOptions

  try {
    await _affiliationRequestFetchNothing({
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
    })
  } catch (error) {
    if (error.info?.status === 422) {
      throw new InvalidInstitutionalEmailError(error.message).withCause(error)
    }
    throw error
  }

  if (!university) {
    return
  }

  // have notifications delete any ip matcher notifications for this university
  try {
    await NotificationsBuilder.promises
      .ipMatcherAffiliation(userId.toString())
      .read(university.id)
  } catch (err) {
    // log and ignore error
    logger.err({ err }, 'Something went wrong marking ip notifications read')
  }
}

async function removeAffiliation(userId, email) {
  await _affiliationRequestFetchNothing404Ok({
    method: 'POST',
    path: `/api/v2/users/${userId.toString()}/affiliations/remove`,
    body: { email },
    defaultErrorMessage: "Couldn't remove affiliation",
  })
}

async function endorseAffiliation(userId, email, role, department) {
  await _affiliationRequestFetchNothing({
    method: 'POST',
    path: `/api/v2/users/${userId.toString()}/affiliations/endorse`,
    body: { email, role, department },
    defaultErrorMessage: "Couldn't endorse affiliation",
  })
}

async function deleteAffiliations(userId) {
  await _affiliationRequestFetchNothing({
    method: 'DELETE',
    path: `/api/v2/users/${userId.toString()}/affiliations`,
    defaultErrorMessage: "Couldn't delete affiliations",
  })
}

// only used by syncUserEntitlements, safe to remove once that script isnt needed
async function addEntitlement(userId, email) {
  const json = await _affiliationRequestFetchJson({
    method: 'POST',
    path: `/api/v2/users/${userId}/affiliations/add_entitlement`,
    body: { email },
    defaultErrorMessage: "Couldn't add entitlement",
  })
  return json
}

async function removeEntitlement(userId, email) {
  await _affiliationRequestFetchNothing404Ok({
    method: 'POST',
    path: `/api/v2/users/${userId}/affiliations/remove_entitlement`,
    body: { email },
    defaultErrorMessage: "Couldn't remove entitlement",
  })
}

async function sendUsersWithReconfirmationsLapsedProcessed(users) {
  await _affiliationRequestFetchNothing({
    method: 'POST',
    path: '/api/v2/institutions/reconfirmation_lapsed_processed',
    body: { users },
    defaultErrorMessage: 'Could not update reconfirmation_lapsed_processed_at',
  })
}

async function verifyDomainMatchesDomainMatcher(domain, institutionId) {
  return await _affiliationRequestFetchJson({
    method: 'POST',
    path: `/api/v2/institutions/domain_matches_matcher`,
    body: { domain, id: institutionId },
    defaultErrorMessage: "Couldn't verify if domain matches matcher",
  })
}

const InstitutionsAPI = {
  getInstitutionAffiliations,
  getConfirmedInstitutionAffiliations,
  getInstitutionAffiliationsCounts,
  getLicencesForAnalytics,
  getUserAffiliations,
  getUsersNeedingReconfirmationsLapsedProcessed,
  addAffiliation,
  removeAffiliation,
  endorseAffiliation,
  deleteAffiliations,
  addEntitlement,
  removeEntitlement,
  sendUsersWithReconfirmationsLapsedProcessed,
  verifyDomainMatchesDomainMatcher,
}

export default {
  promises: InstitutionsAPI,
  ...callbackifyAll(InstitutionsAPI),
}

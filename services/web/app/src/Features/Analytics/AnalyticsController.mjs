import metrics from '@overleaf/metrics'
import AnalyticsManager from './AnalyticsManager.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import GeoIpLookup from '../../infrastructure/GeoIpLookup.mjs'
import Features from '../../infrastructure/Features.mjs'
import { expressify } from '@overleaf/promise-utils'
import AccountMappingHelper from './AccountMappingHelper.mjs'

async function registerSalesforceMapping(req, res, next) {
  if (!Features.hasFeature('analytics')) {
    return res.sendStatus(202)
  }
  const { createdAt, salesforceId, v1Id } = req.body
  AnalyticsManager.registerAccountMapping(
    AccountMappingHelper.generateV1Mapping(v1Id, salesforceId, createdAt)
  )
  res.sendStatus(202)
}

async function updateEditingSession(req, res, next) {
  if (!Features.hasFeature('analytics')) {
    return res.sendStatus(202)
  }
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { projectId } = req.params
  const segmentation = req.body.segmentation || {}
  let countryCode = null

  if (userId) {
    try {
      const geoDetails = await GeoIpLookup.promises.getDetails(req.ip)
      if (geoDetails && geoDetails.country_code) {
        countryCode = geoDetails.country_code
      }
      AnalyticsManager.updateEditingSession(
        userId,
        projectId,
        countryCode,
        segmentation
      )
    } catch (error) {
      metrics.inc('analytics_geo_ip_lookup_errors')
    }
  }
  res.sendStatus(202)
}

// TODO: remove after clients running pre-#36315 code have drained
function isIdleConnectionRestoredEvent(event, body) {
  if (event !== 'connection-restored') {
    return false
  }
  if (body.resolution === 'out-of-sync') {
    return false
  }
  return body.pendingChars === 0 && body.inflightChars === 0
}

function recordEvent(req, res, next) {
  if (!Features.hasFeature('analytics')) {
    return res.sendStatus(202)
  }
  if (isIdleConnectionRestoredEvent(req.params.event, req.body)) {
    metrics.inc('analytics_idle_connection_restored_blocked')
    return res.sendStatus(202)
  }
  delete req.body._csrf
  AnalyticsManager.recordEventForSession(
    req.session,
    req.params.event,
    req.body
  )
  res.sendStatus(202)
}

export default {
  registerSalesforceMapping: expressify(registerSalesforceMapping),
  updateEditingSession: expressify(updateEditingSession),
  recordEvent,
}

import metrics from '@overleaf/metrics'
import Settings from '@overleaf/settings'
import { fetchJson } from '@overleaf/fetch-utils'
import AnalyticsManager from './AnalyticsManager.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import GeoIpLookup from '../../infrastructure/GeoIpLookup.mjs'
import Features from '../../infrastructure/Features.mjs'
import { expressify } from '@overleaf/promise-utils'
import AccountMappingHelper from './AccountMappingHelper.mjs'
import Errors from '../Errors/Errors.js'
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'

// The set of segmentation/event keys is caller-supplied and dynamic (every
// analytics event and editing session sends a different set of dimensions),
// so it can't be enumerated up front -- treat it as a generic string-keyed
// record (genuinely open map, mirroring SplitTestHandler's getAssignmentSchema).
// The key regex mirrors AnalyticsManager's own _isAttributeValid, the only
// validation applied to these keys today; values are never validated there
// either, hence z.unknown().
const attributeKeySchema = z.string().regex(/^[a-zA-Z0-9-_.:;,/]+$/)
const segmentationSchema = z.record(attributeKeySchema, z.unknown())

const registerSalesforceMappingSchema = z.object({
  body: z.strictObject({
    // sent by v1's V2RequestWorker#register_salesforce_mapping
    createdAt: zz.datetime({ offset: true }),
    salesforceId: z.string(),
    v1Id: z.coerce.number().int(),
  }),
})

// Rollout-temporary fallback (loosened primary schema; no zod validation
// existed for this route on main); delete when this route's
// REQ_VALIDATION_MODE instrumentation is removed.
const registerSalesforceMappingFallbackSchema = z.object({
  body: z.object({
    createdAt: z.coerce.date(),
    salesforceId: z.string(),
    v1Id: z.coerce.number(),
  }),
})

async function registerSalesforceMapping(req, res, next) {
  if (!Features.hasFeature('analytics')) {
    return res.sendStatus(202)
  }
  const { body } = parseReq(req, registerSalesforceMappingSchema, {
    logOnly: true,
    fallbackSchema: registerSalesforceMappingFallbackSchema,
  })
  const { createdAt, salesforceId, v1Id } = body
  AnalyticsManager.registerAccountMapping(
    AccountMappingHelper.generateV1Mapping(v1Id, salesforceId, createdAt)
  )
  res.sendStatus(202)
}

const updateEditingSessionSchema = z.object({
  params: z.strictObject({
    projectId: zz.objectId(),
  }),
  body: z.strictObject({
    segmentation: segmentationSchema.optional(),
  }),
})

async function updateEditingSession(req, res, next) {
  if (!Features.hasFeature('analytics')) {
    return res.sendStatus(202)
  }
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { params, body } = parseReq(req, updateEditingSessionSchema, {
    logOnly: true,
  })
  const { projectId } = params
  const segmentation = body.segmentation || {}
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

const recordEventSchema = z.object({
  params: z.strictObject({
    event: zz.eventName(),
  }),
  body: segmentationSchema,
})

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
  const { params, body } = parseReq(req, recordEventSchema, {
    logOnly: true,
  })
  if (isIdleConnectionRestoredEvent(params.event, body)) {
    metrics.inc('analytics_idle_connection_restored_blocked')
    return res.sendStatus(202)
  }
  AnalyticsManager.recordEventForSession(req.session, params.event, body)
  res.sendStatus(202)
}

const uniExternalCollaborationSchema = z.object({
  query: z.object({
    // sent by v1's Api::V2::InstitutionsController#external_collaboration_data
    university_id: z.coerce.number().int().positive(),
  }),
})

async function uniExternalCollaboration(req, res) {
  if (!Settings.apis.analytics) {
    throw new Errors.ServiceNotConfiguredError(
      'Analytics service not configured'
    )
  }
  const { query } = parseReq(req, uniExternalCollaborationSchema)
  const url = new URL('/uniExternalCollaboration', Settings.apis.analytics.url)
  url.searchParams.set('university_id', query.university_id)
  res.json(await fetchJson(url, { signal: AbortSignal.timeout(20_000) }))
}

export default {
  registerSalesforceMapping: expressify(registerSalesforceMapping),
  uniExternalCollaboration: expressify(uniExternalCollaboration),
  updateEditingSession: expressify(updateEditingSession),
  recordEvent,
}

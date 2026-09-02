import RequestHelper from './RequestHelper.mjs'
import AnalyticsManager from './AnalyticsManager.mjs'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import { parseReq, getRawReqInput } from '../../infrastructure/Validation.mjs'
import UrlHelper from '../Helpers/UrlHelper.mjs'

function recordUTMTags() {
  return function (req, res, next) {
    const rawQuery = getRawReqInput(req).query

    try {
      const { query } = parseReq(req, RequestHelper.utmQuerySchema, {
        logOnly: true,
      })

      const utmValues = RequestHelper.parseUtm(query)

      if (utmValues) {
        const path = new URL(req.url, Settings.siteUrl).pathname

        const host = req.headers.host
        const domain = host?.split('.')[0]

        AnalyticsManager.recordEventForSession(req.session, 'page-view', {
          path,
          ...utmValues,
          domain,
        })

        const propertyValue = `${utmValues.utm_source || 'N/A'};${
          utmValues.utm_medium || 'N/A'
        };${utmValues.utm_campaign || 'N/A'};${
          utmValues.utm_content || utmValues.utm_term || 'N/A'
        }`
        AnalyticsManager.setUserPropertyForSessionInBackground(
          req.session,
          'utm-tags',
          propertyValue
        )
      }
    } catch (error) {
      // log errors and fail silently
      logger.warn({ error, rawQuery, req }, 'failed to track UTM tags')
    }

    try {
      const strippedQuery = RequestHelper.stripUTMKeys(rawQuery)
      const allFields = Object.keys(rawQuery).length
      const withoutUTM = Object.keys(strippedQuery).length
      if (allFields !== withoutUTM) {
        let redirect =
          UrlHelper.getSafeRedirectPath(
            // Drop the query from URL, we will add our own below.
            new URL(req.url, Settings.siteUrl).pathname
          ) || '/'
        if (withoutUTM > 0) redirect += `?${new URLSearchParams(strippedQuery)}`
        res.redirect(redirect)
        return
      }
    } catch (err) {
      // log errors and fail silently
      logger.warn(
        { err, rawQuery, req },
        'failed to remove UTM tags from query'
      )
    }

    next()
  }
}

export default {
  recordUTMTags,
}

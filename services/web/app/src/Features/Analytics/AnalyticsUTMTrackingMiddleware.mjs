import _ from 'lodash'
import RequestHelper from './RequestHelper.mjs'
import AnalyticsManager from './AnalyticsManager.mjs'
import querystring from 'node:querystring'
import { URL } from 'node:url'
import Settings from '@overleaf/settings'
import OError from '@overleaf/o-error'
import logger from '@overleaf/logger'

function recordUTMTags() {
  return function (req, res, next) {
    const query = req.query

    try {
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

        // redirect to URL without UTM query params
        const queryWithoutUtm = _.omit(query, RequestHelper.UTM_KEYS)
        const queryString =
          Object.keys(queryWithoutUtm).length > 0
            ? '?' + querystring.stringify(queryWithoutUtm)
            : ''
        return res.redirect(path + queryString)
      }
    } catch (error) {
      // log errors and fail silently
      OError.tag(error, 'failed to track UTM tags', {
        query,
      })
      logger.warn({ error }, error.message)
    }

    next()
  }
}

export default {
  recordUTMTags,
}

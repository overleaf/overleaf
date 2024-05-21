const _ = require('lodash')
const RequestHelper = require('./RequestHelper')
const AnalyticsManager = require('./AnalyticsManager')
const querystring = require('querystring')
const { URL } = require('url')
const Settings = require('@overleaf/settings')
const OError = require('@overleaf/o-error')
const logger = require('@overleaf/logger')

function recordUTMTags() {
  return function (req, res, next) {
    const query = req.query

    try {
      const utmValues = RequestHelper.parseUtm(query)

      if (utmValues) {
        const path = new URL(req.url, Settings.siteUrl).pathname

        AnalyticsManager.recordEventForSession(req.session, 'page-view', {
          path,
          ...utmValues,
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

module.exports = {
  recordUTMTags,
}

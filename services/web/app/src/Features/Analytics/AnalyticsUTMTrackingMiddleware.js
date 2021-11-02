const _ = require('lodash')
const { URL } = require('url')
const RequestHelper = require('./RequestHelper')
const AnalyticsManager = require('./AnalyticsManager')
const querystring = require('querystring')
const OError = require('@overleaf/o-error')
const logger = require('logger-sharelatex')

function recordUTMTags() {
  return function (req, res, next) {
    const query = req.query

    try {
      const utmValues = RequestHelper.parseUtm(query)

      if (utmValues) {
        const pathname = new URL(req.url).pathname

        AnalyticsManager.recordEventForSession(req.session, 'page-view', {
          path: pathname,
          ...utmValues,
        })

        const propertyValue = [
          'utm_source',
          'utm_medium',
          'utm_campaign',
          'utm_term',
        ]
          .map(tag => utmValues[tag] || 'N/A')
          .join(';')
        AnalyticsManager.setUserPropertyForSession(
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
        res.redirect(pathname + queryString)
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

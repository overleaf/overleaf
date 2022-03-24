const AuthenticationController = require('./../Authentication/AuthenticationController')
const AnalyticsController = require('./AnalyticsController')
const AnalyticsProxy = require('./AnalyticsProxy')
const RateLimiterMiddleware = require('./../Security/RateLimiterMiddleware')
const { expressify } = require('../../util/promises')

module.exports = {
  apply(webRouter, privateApiRouter, publicApiRouter) {
    webRouter.post(
      '/event/:event([a-z0-9-_]+)',
      RateLimiterMiddleware.rateLimit({
        endpointName: 'analytics-record-event',
        maxRequests: 200,
        timeInterval: 60,
      }),
      AnalyticsController.recordEvent
    )

    webRouter.put(
      '/editingSession/:projectId',
      RateLimiterMiddleware.rateLimit({
        endpointName: 'analytics-update-editing-session',
        params: ['projectId'],
        maxRequests: 20,
        timeInterval: 60,
      }),
      expressify(AnalyticsController.updateEditingSession)
    )

    publicApiRouter.use(
      '/analytics/uniExternalCollaboration',
      AuthenticationController.requirePrivateApiAuth(),
      RateLimiterMiddleware.rateLimit({
        endpointName: 'analytics-uni-external-collab-proxy',
        maxRequests: 20,
        timeInterval: 60,
      }),
      AnalyticsProxy.call('/uniExternalCollaboration')
    )
  },
}

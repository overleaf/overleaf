const AuthenticationController = require('./../Authentication/AuthenticationController')
const AnalyticsController = require('./AnalyticsController')
const AnalyticsProxy = require('./AnalyticsProxy')
const { RateLimiter } = require('../../infrastructure/RateLimiter')
const RateLimiterMiddleware = require('../Security/RateLimiterMiddleware')
const { expressify } = require('../../util/promises')

const rateLimiters = {
  recordEvent: new RateLimiter('analytics-record-event', {
    points: 200,
    duration: 60,
  }),
  updateEditingSession: new RateLimiter('analytics-update-editing-session', {
    points: 20,
    duration: 60,
  }),
  uniExternalCollabProxy: new RateLimiter(
    'analytics-uni-external-collab-proxy',
    { points: 20, duration: 60 }
  ),
}

module.exports = {
  apply(webRouter, privateApiRouter, publicApiRouter) {
    webRouter.post(
      '/event/:event([a-z0-9-_]+)',
      RateLimiterMiddleware.rateLimit(rateLimiters.recordEvent),
      AnalyticsController.recordEvent
    )

    webRouter.put(
      '/editingSession/:projectId',
      RateLimiterMiddleware.rateLimit(rateLimiters.updateEditingSession, {
        params: ['projectId'],
      }),
      expressify(AnalyticsController.updateEditingSession)
    )

    publicApiRouter.use(
      '/analytics/uniExternalCollaboration',
      AuthenticationController.requirePrivateApiAuth(),
      RateLimiterMiddleware.rateLimit(rateLimiters.uniExternalCollabProxy),
      AnalyticsProxy.call('/uniExternalCollaboration')
    )
  },
}

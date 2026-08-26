import AuthenticationController from './../Authentication/AuthenticationController.mjs'
import AnalyticsController from './AnalyticsController.mjs'
import { RateLimiter } from '../../infrastructure/RateLimiter.mjs'
import RateLimiterMiddleware from '../Security/RateLimiterMiddleware.mjs'

const rateLimiters = {
  recordEvent: new RateLimiter('analytics-record-event', {
    points: 200,
    duration: 60,
  }),
  updateEditingSession: new RateLimiter('analytics-update-editing-session', {
    points: 20,
    duration: 60,
  }),
  uniExternalCollaboration: new RateLimiter(
    'analytics-uni-external-collaboration',
    { points: 20, duration: 60 }
  ),
}

export default {
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
      AnalyticsController.updateEditingSession
    )

    publicApiRouter.get(
      '/analytics/uniExternalCollaboration',
      AuthenticationController.requirePrivateApiAuth(),
      RateLimiterMiddleware.rateLimit(rateLimiters.uniExternalCollaboration),
      AnalyticsController.uniExternalCollaboration
    )

    publicApiRouter.post(
      '/analytics/register-v-1-salesforce-mapping',
      AuthenticationController.requirePrivateApiAuth(),
      AnalyticsController.registerSalesforceMapping
    )
  },
}

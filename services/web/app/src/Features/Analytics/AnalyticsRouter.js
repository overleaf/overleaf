const AuthenticationController = require('./../Authentication/AuthenticationController')
const AnalyticsController = require('./AnalyticsController')
const AnalyticsProxy = require('./AnalyticsProxy')

module.exports = {
  apply(webRouter, privateApiRouter, publicApiRouter) {
    webRouter.post(
      '/event/:event([a-z0-9-_]+)',
      AnalyticsController.recordEvent
    )

    webRouter.put(
      '/editingSession/:projectId',
      AnalyticsController.updateEditingSession
    )

    publicApiRouter.use(
      '/analytics/uniExternalCollaboration',
      AuthenticationController.httpAuth,
      AnalyticsProxy.call('/uniExternalCollaboration')
    )
  }
}

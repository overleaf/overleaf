const AuthenticationController = require('./../Authentication/AuthenticationController')
const AnalyticsController = require('./AnalyticsController')
const AnalyticsProxy = require('./AnalyticsProxy')

module.exports = {
  apply(webRouter, privateApiRouter, publicApiRouter) {
    webRouter.post('/event/:event', AnalyticsController.recordEvent)

    webRouter.put(
      '/editingSession/:projectId',
      AnalyticsController.updateEditingSession
    )

    publicApiRouter.use(
      '/analytics/graphs',
      AuthenticationController.httpAuth,
      AnalyticsProxy.call('/graphs')
    )

    publicApiRouter.use(
      '/analytics/recentTeamActivity',
      AuthenticationController.httpAuth,
      AnalyticsProxy.call('/recentTeamActivity')
    )

    publicApiRouter.use(
      '/analytics/recentV1TemplateIdsActivity',
      AuthenticationController.httpAuth,
      AnalyticsProxy.call('/recentV1TemplateIdsActivity')
    )

    publicApiRouter.use(
      '/analytics/uniExternalCollaboration',
      AuthenticationController.httpAuth,
      AnalyticsProxy.call('/uniExternalCollaboration')
    )
  }
}

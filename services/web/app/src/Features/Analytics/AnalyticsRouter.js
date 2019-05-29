// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
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

    return publicApiRouter.use(
      '/analytics/uniExternalCollaboration',
      AuthenticationController.httpAuth,
      AnalyticsProxy.call('/uniExternalCollaboration')
    )
  }
}

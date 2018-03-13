AuthenticationController = require './../Authentication/AuthenticationController'
AnalyticsController = require('./AnalyticsController')
AnalyticsProxy = require('./AnalyticsProxy')

module.exports =
	apply: (webRouter, privateApiRouter, publicApiRouter) ->
		webRouter.post '/event/:event', AnalyticsController.recordEvent

		webRouter.put  '/editingSession/:projectId',
			AnalyticsController.updateEditingSession

		publicApiRouter.use '/analytics/graphs',
			AuthenticationController.httpAuth,
			AnalyticsProxy.call('/graphs')

		publicApiRouter.use '/analytics/recentTeamActivity',
			AuthenticationController.httpAuth,
			AnalyticsProxy.call('/recentTeamActivity')

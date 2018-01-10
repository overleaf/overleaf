AuthenticationController = require './../Authentication/AuthenticationController'
AnalyticsController = require('./AnalyticsController')
AnalyticsProxy = require('./AnalyticsProxy')

module.exports =
	apply: (webRouter, privateApiRouter) ->
		webRouter.post '/event/:event', AnalyticsController.recordEvent
		privateApiRouter.use '/analytics/graphs',
			AuthenticationController.httpAuth,
			AnalyticsProxy.call('/graphs')

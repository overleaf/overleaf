AnalyticsController = require('./AnalyticsController')

module.exports =
	apply: (webRouter, apiRouter) ->
		webRouter.post '/event/:event', AnalyticsController.recordEvent

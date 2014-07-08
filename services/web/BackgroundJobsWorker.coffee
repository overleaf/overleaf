settings = require('settings-sharelatex')
TpdsPollingBackgroundTasks = require("./app/js/Features/ThirdPartyDataStore/TpdsPollingBackgroundTasks")

time =
	oneHour : 60 * 60 * 1000
	fifteenMinutes : 15 * 60 * 1000
	thirtySeconds : 30 * 1000
	betweenThirtyAndFiveHundredSeconds: =>
		random = Math.floor(Math.random() * 500) * 1000
		if random < time.thirtySeconds
			return time.betweenThirtyAndFiveHundredSeconds()
		else
			return random

runPeriodically = (funcToRun, periodLength)->
	recursiveReference = ->
		funcToRun ->
			setTimeout recursiveReference, periodLength
	setTimeout recursiveReference, 0

runPeriodically ((cb) -> TpdsPollingBackgroundTasks.pollUsersWithDropbox(cb)), time.fifteenMinutes

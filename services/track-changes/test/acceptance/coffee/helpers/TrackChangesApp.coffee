app = require('../../../../app')
require("logger-sharelatex").logger.level("info")
logger = require("logger-sharelatex")
Settings = require("settings-sharelatex")

module.exports =
	running: false
	initing: false
	callbacks: []
	ensureRunning: (callback = (error) ->) ->
		if @running
			return callback()
		else if @initing
			@callbacks.push callback
		else
			@initing = true
			@callbacks.push callback
			app.listen Settings.internal?.trackchanges?.port, "localhost", (error) => 
				throw error if error?
				@running = true
				logger.log("track changes running in dev mode")

				for callback in @callbacks
					callback()
app = require('../../../../app')
require("logger-sharelatex").logger.level("error")

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
			app.listen 3010, "localhost", (error) => 
				throw error if error?
				@running = true
				for callback in @callbacks
					callback()
app = require('../../../app')
require("logger-sharelatex").logger.level("info")
logger = require("logger-sharelatex")
Settings = require("settings-sharelatex")
request = require('request')

S3_TRIES = 30

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
			app.listen Settings.internal?.filestore?.port, "localhost", (error) => 
				throw error if error?
				@running = true
				logger.log("filestore running in dev mode")

				for callback in @callbacks
					callback()

	waitForS3: (callback, tries) ->
		return callback() unless Settings.filestore.s3?.endpoint
		tries = 1 unless tries

		request.get "#{Settings.filestore.s3.endpoint}/", (err, response) =>
			console.log(err, response?.statusCode, tries)
			if !err && [200, 404].includes(response?.statusCode)
				return callback()

			if tries == S3_TRIES
				return callback('timed out waiting for S3')

			setTimeout(
				() =>
					@waitForS3 callback, tries + 1
				1000
			)

bunyan = require('bunyan')

module.exports = Logger =
	initialize: (name) ->
		@logger = bunyan.createLogger
			name: name
			serializers: bunyan.stdSerializers
		return @
	
	initializeErrorReporting: (sentry_dsn) ->
		raven = require "raven"
		@raven = new raven.Client(sentry_dsn)
	
	info : ()->
		@logger.info.apply(@logger, arguments)
	log : ()->
		@logger.info.apply(@logger, arguments)
	error: (attributes, args...)->
		@logger.error(attributes, args...)
		if @raven?
			error = attributes.err or attributes.error
			if error?
				@raven.captureError(error, attributes)
	err: ()->
		@logger.error.apply(@logger, arguments)
	warn: ()->
		@logger.warn.apply(@logger, arguments)

Logger.initialize("default-sharelatex")

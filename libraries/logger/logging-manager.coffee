bunyan = require('bunyan')

module.exports = Logger =
	initialize: (name) ->
		@logger = bunyan.createLogger
			name: name
			serializers: bunyan.stdSerializers
		return @
	info : ()->
		@logger.info.apply(@logger, arguments)
	log : ()->
		@logger.info.apply(@logger, arguments)
	error: ()->
		@logger.error.apply(@logger, arguments)
	err: ()->
		@logger.error.apply(@logger, arguments)
	warn: ()->
		@logger.warn.apply(@logger, arguments)

Logger.initialize("default-sharelatex")

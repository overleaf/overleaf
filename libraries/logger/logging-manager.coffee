bunyan = require('bunyan')

module.exports = Logger =
	initialize: (name) ->
		@logger = bunyan.createLogger
			name: name
			serializers: bunyan.stdSerializers
		return @
	
	initializeErrorReporting: (sentry_dsn, options) ->
		raven = require "raven"
		@raven = new raven.Client(sentry_dsn, options)
	
	info : ()->
		@logger.info.apply(@logger, arguments)
	log : ()->
		@logger.info.apply(@logger, arguments)
	error: (attributes, args...)->
		@logger.error(attributes, args...)
		if @raven?
			error = attributes.err or attributes.error
			req = attributes.req
			if error?
				tags = {}
				extra = {}
				for key, value of attributes
					tags[key] = value if key.match(/_id/) and typeof value == 'string'
					extra[key] = value
				if req?
					extra.req =
						method: req.method
						url: req.originalUrl
						query: req.query
						headers: req.headers
						ip: req.ip
				# recreate error objects that have been converted to a normal object
				if !(error instanceof Error) and typeof error is "object"
					newError = new Error(error.message)
					for own key, value of error
						newError[key] = value
					error = newError
				@raven.captureError(error, {tags: tags, extra: extra})
	err: ()->
		@logger.error.apply(@logger, arguments)
	warn: ()->
		@logger.warn.apply(@logger, arguments)

Logger.initialize("default-sharelatex")

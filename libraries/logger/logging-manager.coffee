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

	captureException: (attributes, message, level) ->
		error = attributes.err or attributes.error or message
		req = attributes.req
		if error?
			tags = {}
			extra = {}
			# capture attributes and use *_id objects as tags
			for key, value of attributes
				tags[key] = value if key.match(/_id/) and typeof value == 'string'
				extra[key] = value
			# capture req object if available
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
			# send the error to sentry
			@raven.captureException(error, {tags: tags, extra: extra, level: level})

	info : ()->
		@logger.info.apply(@logger, arguments)
	log : ()->
		@logger.info.apply(@logger, arguments)
	error: (attributes, message, args...)->
		@logger.error(attributes, message, args...)
		@captureException(attributes, message, "error") if @raven?
	err: () ->
		@error.apply(this, arguments)
	warn: ()->
		@logger.warn.apply(@logger, arguments)
	fatal: (attributes, message, callback) ->
		@logger.fatal(attributes, message)
		if @raven?
			cb = (e) -> # call the callback once after 'logged' or 'error' event
				callback()
				cb = () ->
			@captureException(attributes, message, "fatal")
			@raven.once 'logged', cb
			@raven.once 'error', cb
		else
			callback()

Logger.initialize("default-sharelatex")

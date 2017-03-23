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
		@lastErrorTimeStamp = 0 # for rate limiting on sentry reporting
		@lastErrorCount = 0

	captureException: (attributes, message, level) ->
		# handle case of logger.error "message"
		if typeof attributes is 'string'
			attributes = {err: new Error(attributes)}
		# extract any error object
		error = attributes.err or attributes.error
		# include our log message in the error report
		if not error?
			error = {message: message} if typeof message is 'string'
		else if message?
			attributes.description = message
		# report the error
		if error?
			# capture attributes and use *_id objects as tags
			tags = {}
			extra = {}
			for key, value of attributes
				tags[key] = value if key.match(/_id/) and typeof value == 'string'
				extra[key] = value
			# capture req object if available
			req = attributes.req
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
			try
				@raven.captureException(error, {tags: tags, extra: extra, level: level})
			catch
				return # ignore any errors

	info : ()->
		@logger.info.apply(@logger, arguments)
	log : ()->
		@logger.info.apply(@logger, arguments)
	error: (attributes, message, args...)->
		@logger.error(attributes, message, args...)
		if @raven?
			MAX_ERRORS = 5 # maximum number of errors in 1 minute
			now = new Date()
			# have we recently reported an error?
			recentSentryReport = (now - @lastErrorTimeStamp) < 60 * 1000
			# if so, increment the error count
			if recentSentryReport
				@lastErrorCount++
			else
				@lastErrorCount = 0
				@lastErrorTimeStamp = now
			# only report 5 errors every minute to avoid overload
			if @lastErrorCount <= MAX_ERRORS
				# add a note if the rate limit has been hit
				note = if @lastErrorCount is MAX_ERRORS then "(rate limited)" else ""
				# report the exception
				@captureException(attributes, message, "error#{note}")
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

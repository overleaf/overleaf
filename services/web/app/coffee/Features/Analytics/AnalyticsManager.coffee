settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
_ = require "underscore"
request = require "requestretry"
Errors = require '../Errors/Errors'


makeRequest = (opts, callback)->
	if settings.apis?.analytics?.url?
		urlPath = opts.url
		opts.url = "#{settings.apis.analytics.url}#{urlPath}"
		request(opts)
		callback() # Do not wait for all the attempts
	else
		callback(new Errors.ServiceNotConfiguredError('Analytics service not configured'))


# Set an exponential backoff to retry calls to analytics. First retry will
# happen after 4s, then 8, 16, 32, 64...
exponentialBackoffStrategy = () ->
	attempts = 1 # This won't be called until there has been 1 failure

	() ->
		attempts += 1
		exponentialBackoffDelay(attempts)

exponentialBackoffDelay = (attempts) ->
	delay = 2 ** attempts * 1000

	logger.warn "Error comunicating with the analytics service. " +
		"Will try again attempt #{attempts} in #{delay}ms"

	delay


module.exports =

	identifyUser: (user_id, old_user_id, callback = (error)->)->
		opts =
			body:
				old_user_id:old_user_id
			json:true
			method:"POST"
			timeout:1000
			url: "/user/#{user_id}/identify"
		makeRequest opts, callback

	recordEvent: (user_id, event, segmentation = {}, callback = (error) ->) ->
		if user_id+"" == settings.smokeTest?.userId+""
			return callback()
		opts =
			body:
				event:event
				segmentation:segmentation
			json:true
			method:"POST"
			timeout:1000
			url: "/user/#{user_id}/event"
			delayStrategy: exponentialBackoffStrategy()
			maxAttempts: 7 # Give up after ~ 8min
		if settings.overleaf?
			opts.qs = {fromV2: 1}
		makeRequest opts, callback

	updateEditingSession: (userId, projectId, countryCode, callback = (error) ->) ->
		if userId+"" == settings.smokeTest?.userId+""
			return callback()
		query =
			userId: userId
			projectId: projectId
		if countryCode
			query.countryCode = countryCode
		opts =
			method: "PUT"
			timeout: 1000
			url: "/editingSession"
			qs: query
			maxAttempts: 6 # Give up after ~ 4min
			delayStrategy: exponentialBackoffStrategy()
		if settings.overleaf?
			opts.qs.fromV2 = 1
		makeRequest opts, callback


	getLastOccurrence: (user_id, event, callback = (error) ->) ->
		opts =
			body:
				event:event
			json:true
			method:"POST"
			timeout:1000
			url: "/user/#{user_id}/event/last_occurrence"
		makeRequest opts, (err, response, body)->
			if err?
				console.log response, opts
				logger.err {user_id, err}, "error getting last occurance of event"
				return callback err
			else
				return callback null, body

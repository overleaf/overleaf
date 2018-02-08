settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
_ = require "underscore"
request = require "request"
Errors = require '../Errors/Errors'


makeRequest = (opts, callback)->
	retryTimings = [1, 2, 4, 8, 16, 32, 32, 32]
	if settings.apis?.analytics?.url?
		urlPath = opts.url
		opts.url = "#{settings.apis.analytics.url}#{urlPath}"
		iteration = 0
		_go = () ->
			request opts, (err, response, data) ->
				if err?
					if iteration == retryTimings.length
						logger.err {err, url: opts.url},
							"Error in analytics request, retries failed"
						return callback(err)
					backoffSeconds = retryTimings[iteration]
					iteration += 1
					setTimeout(_go, backoffSeconds * 1000)
				else
					callback(null, response, data)
		_go()
	else
		callback(new Errors.ServiceNotConfiguredError('Analytics service not configured'))


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
		if settings.overleaf?
			opts.qs = {fromV2: 1}
		makeRequest opts, callback

	updateEditingSession: (userId, projectId, segmentation = {}, callback = (error) ->) ->
		if userId+"" == settings.smokeTest?.userId+""
			return callback()
		opts =
			body:
				segmentation: segmentation
			json: true
			method: "PUT"
			timeout: 1000
			url: "/editingSession"
			qs:
				userId: userId
				projectId: projectId
		if settings.overleaf?
			opts.qs.fromV2 = 1
		makeRequest opts, callback


	getLastOccurance: (user_id, event, callback = (error) ->) ->
		opts =
			body:
				event:event
			json:true
			method:"POST"
			timeout:1000
			url: "/user/#{user_id}/event/last_occurnace"
		makeRequest opts, (err, response, body)->
			if err?
				console.log response, opts
				logger.err {user_id, err}, "error getting last occurance of event"
				return callback err
			else
				return callback null, body

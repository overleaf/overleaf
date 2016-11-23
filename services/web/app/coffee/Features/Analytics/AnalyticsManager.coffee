settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
_ = require "underscore"
request = require "request"


makeRequest = (opts, callback)->
	if settings.apis?.analytics?.url?
		urlPath = opts.url
		opts.url = "#{settings.apis.analytics.url}#{urlPath}"
		request opts, callback
	else
		callback()



module.exports =


	recordEvent: (user_id, event, segmentation = {}, callback = (error) ->) ->
		if user_id == settings.smokeTest?.userId
			return callback()
		opts =
			body:
				event:event
				segmentation:segmentation
			json:true
			method:"POST"
			timeout:1000
			url: "/user/#{user_id}/event"
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

settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
_ = require "underscore"
request = require "request"



module.exports =

	recordEvent: (user_id, event, segmentation = {}, callback = (error) ->) ->
		opts =
			body:
				event:event
				segmentation:segmentation
			json:true
			method:"POST"
			timeout:1000
			url: "#{settings.apis.analytics.url}/user/#{user_id}/event"
		request opts, callback


	getLastOccurance: (user_id, event, callback = (error) ->) ->
		opts =
			body:
				event:event
			json:true
			method:"POST"
			timeout:1000
			url: "#{settings.apis.analytics.url}/user/#{user_id}/event/last_occurnace"
		request opts, (err, response, body)->
			if err? 
				console.log response, opts
				logger.err {user_id, err}, "error getting last occurance of event"
				return callback err
			else
				return callback null, body
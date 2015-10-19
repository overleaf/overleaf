settings = require "settings-sharelatex"
request = require "request"
logger = require "logger-sharelatex"

module.exports = TrackChangesManager =
	flushProject: (project_id, callback = (error) ->) ->
		logger.log project_id: project_id, "flushing project in track-changes api"
		url = "#{settings.apis.trackchanges.url}/project/#{project_id}/flush"
		request.post url, (error, res, body) ->
			return callback(error) if error?
			if 200 <= res.statusCode < 300
				callback(null)
			else
				error = new Error("track-changes api responded with non-success code: #{res.statusCode} #{url}")
				logger.error err: error, project_id: project_id, "error flushing project in track-changes api"
				callback(error)

	archiveProject: (project_id, callback = ()->)->
		logger.log project_id: project_id, "archving project in track-changes api"
		url = "#{settings.apis.trackchanges.url}/project/#{project_id}/archive"
		request.post url, (error, res, body) ->
			return callback(error) if error?
			if 200 <= res.statusCode < 300
				callback(null)
			else
				error = new Error("track-changes api responded with non-success code: #{res.statusCode} #{url}")
				logger.error err: error, project_id: project_id, "error archving project in track-changes api"
				callback(error)
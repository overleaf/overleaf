_ = require('underscore')
settings = require("settings-sharelatex")
request = require("request")
logger = require("logger-sharelatex")

TIMEOUT = 1000
module.exports = TagsHandler =
	getAllTags: (user_id, callback)->
		@_requestTags user_id, (err, allTags)=>
			if !allTags?
				allTags = []
			@_groupTagsByProject allTags, (err, groupedByProject)->
				logger.log allTags:allTags, user_id:user_id, groupedByProject:groupedByProject, "got all tags from tags api"
				callback err, allTags, groupedByProject
	
	createTag: (user_id, name, callback = (error, tag) ->) ->
		opts = 
			url: "#{settings.apis.tags.url}/user/#{user_id}/tag"
			json:
				name: name
			timeout: TIMEOUT
		request.post opts, (err, res, body)->
			TagsHandler._handleResponse err, res, {user_id}, (error) ->
				return callback(error) if error?
				callback(null, body or {})

	renameTag: (user_id, tag_id, name, callback = (error) ->) ->
		url = "#{settings.apis.tags.url}/user/#{user_id}/tag/#{tag_id}/rename"
		request.post {
			url: url
			json:
				name: name
			timeout: TIMEOUT
		}, (err, res, body) ->
			TagsHandler._handleResponse err, res, {url, user_id, tag_id, name}, callback

	deleteTag: (user_id, tag_id, callback = (error) ->) ->
		url = "#{settings.apis.tags.url}/user/#{user_id}/tag/#{tag_id}"
		request.del {url, timeout: TIMEOUT}, (err, res, body) ->
			TagsHandler._handleResponse err, res, {url, user_id, tag_id}, callback

	removeProjectFromTag: (user_id, tag_id, project_id, callback)->
		url = "#{settings.apis.tags.url}/user/#{user_id}/tag/#{tag_id}/project/#{project_id}"
		request.del {url, timeout: TIMEOUT}, (err, res, body) ->
			TagsHandler._handleResponse err, res, {url, user_id, tag_id, project_id}, callback

	addProjectToTag: (user_id, tag_id, project_id, callback)->
		url = "#{settings.apis.tags.url}/user/#{user_id}/tag/#{tag_id}/project/#{project_id}"
		request.post {url, timeout: TIMEOUT}, (err, res, body) ->
			TagsHandler._handleResponse err, res, {url, user_id, tag_id, project_id}, callback

	removeProjectFromAllTags: (user_id, project_id, callback)->
		url = "#{settings.apis.tags.url}/user/#{user_id}/project/#{project_id}"
		opts =
			url: url
			timeout:TIMEOUT
		request.del opts, (err, res, body) ->
			TagsHandler._handleResponse err, res, {url, user_id, project_id}, callback

	_handleResponse: (err, res, params, callback) ->
		if err?
			params.err = err
			logger.err params, "error in tag api"
			return callback(err)
		else if res? and res.statusCode >= 200 and res.statusCode < 300
			return callback(null)
		else
			err = new Error("tags api returned a failure status code: #{res?.statusCode}")
			params.err = err
			logger.err params, "tags api returned failure status code: #{res?.statusCode}"
			return callback(err)

	_requestTags: (user_id, callback)->
		opts = 
			url: "#{settings.apis.tags.url}/user/#{user_id}/tag"
			json: true
			timeout: TIMEOUT
		request.get opts, (err, res, body)->
			TagsHandler._handleResponse err, res, {user_id}, (error) ->
				return callback(error, []) if error?
				callback(null, body or [])

	_groupTagsByProject: (tags, callback)->
		result = {}
		_.each tags, (tag)->
			_.each tag.project_ids, (project_id)->
				result[project_id] = []

		_.each tags, (tag)->
			_.each tag.project_ids, (project_id)->
				clonedTag = _.clone(tag)
				delete clonedTag.project_ids
				result[project_id].push(clonedTag)
		callback null, result

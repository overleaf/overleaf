request = require("request")
settings = require("settings-sharelatex")
logger = require("logger-sharelatex")

module.exports = 

	publish : (user_id, project_id, callback)->
		url = buildUrl(user_id, project_id)
		request.post url, (err)->
			if err?
				logger.err err:err, "something went wrong publishing project as template"
			callback err

	unpublish: (user_id, project_id, callback)->
		url = buildUrl(user_id, project_id)
		request.del url, (err)->
			callback()


	getTemplateDetails: (user_id, project_id, callback)->
		url = buildUrl(user_id, project_id)+"/details"
		request.get url, (err, res, body)->
			if err?
				logger.err err:err, user_id:user_id, project_id:project_id, body:body, "error getting template details"
				return callback err
			try
				json = JSON.parse body
			catch err
				logger.err err:err, user_id:user_id, project_id:project_id, body:body, "error parsing project json details"
				return callback err
			logger.log json:json, user_id:user_id, project_id:project_id, "got template details"
			callback(err, json)


buildUrl = (user_id, project_id)->
	url = "#{settings.apis.templates_api.url}/templates/user/#{user_id}/project/#{project_id}"

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
			try
				json = JSON.parse body
			catch err
				return callback err
			callback(err, json)


buildUrl = (user_id, project_id)->
	url = "#{settings.apis.templates_api.url}/templates-api/user/#{user_id}/project/#{project_id}"

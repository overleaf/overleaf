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


buildUrl = (user_id, project_id)->
	url = "#{settings.apis.templates_api.url}/templates-api/user/#{user_id}/project/#{project_id}"

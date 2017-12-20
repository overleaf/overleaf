request = require "request"
settings = require "settings-sharelatex"

module.exports = HistoryManager =
	initializeProject: (callback = (error, history_id) ->) ->
		return callback() if !settings.apis.project_history?.initializeHistoryForNewProjects
		request.post {
			url: "#{settings.apis.project_history.url}/project"
		}, (error, res, body)->
			return callback(error) if error?

			if res.statusCode >= 200 and res.statusCode < 300
				try
					project = JSON.parse(body)
				catch error
					return callback(error)

				overleaf_id = project?.project?.id
				if !overleaf_id
					error = new Error("project-history did not provide an id", project)
					return callback(error)

				callback null, { overleaf_id }
			else
				error = new Error("project-history returned a non-success status code: #{res.statusCode}")
				callback error
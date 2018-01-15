request = require "request"
settings = require "settings-sharelatex"
async = require 'async'
UserGetter = require "../User/UserGetter"

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

	injectUserDetails: (data, callback = (error, data_with_users) ->) ->
		# data can be either:
		# {
		# 	diff: [{
		# 		i: "foo",
		# 		meta: {
		# 			users: ["user_id", { first_name: "James", ... }, ...]
		# 			...
		# 		}
		# 	}, ...]
		# }
		# or
		# {
		# 	updates: [{
		# 		pathnames: ["main.tex"]
		# 		meta: {
		# 			users: ["user_id", { first_name: "James", ... }, ...]
		# 			...
		# 		},
		# 		...
		# 	}, ...]
		# }
		# Either way, the top level key points to an array of objects with a meta.users property
		# that we need to replace user_ids with populated user objects.
		# Note that some entries in the users arrays may already have user objects from the v1 history
		# service
		user_ids = new Set()
		for entry in data.diff or data.updates or []
			for user in entry.meta?.users or []
				if typeof user == "string"
					user_ids.add user
		user_ids = Array.from(user_ids)
		UserGetter.getUsers user_ids, { first_name: 1, last_name: 1, email: 1 }, (error, users_array) ->
			return callback(error) if error?
			users = {}
			for user in users_array or []
				users[user._id.toString()] = HistoryManager._userView(user)
			for entry in data.diff or data.updates or []
				entry.meta?.users = (entry.meta?.users or []).map (user) ->
					if typeof user == "string"
						return users[user]
					else
						return user
			callback null, data

	_userView: (user) ->
		{ _id, first_name, last_name, email } = user
		return { first_name, last_name, email, id: _id }
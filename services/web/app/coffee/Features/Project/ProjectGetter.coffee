mongojs = require("../../infrastructure/mongojs")
db = mongojs.db
ObjectId = mongojs.ObjectId
async = require "async"
Errors = require("../../errors")

module.exports = ProjectGetter =
	EXCLUDE_DEPTH: 8


	_returnProjectIfPassed: (project_or_id, callback, continueCallback)->
		if project_or_id._id?
			callback null, project_or_id
		else
			try
				ObjectId(project_or_id.toString())
			catch e
				return continueCallback(new Errors.NotFoundError(e.message))
			continueCallback()

	getProjectWithoutDocLines: (project_or_id, callback=(error, project) ->) ->
		ProjectGetter._returnProjectIfPassed project_or_id, callback, (err)->
			return callback(err) if err?
			project_id = project_or_id
			excludes = {}
			for i in [1..ProjectGetter.EXCLUDE_DEPTH]
				excludes["rootFolder#{Array(i).join(".folder")}.docs.lines"] = 0
			db.projects.find _id: ObjectId(project_id.toString()), excludes, (error, projects = []) ->
				callback error, projects[0]

	getProjectWithOnlyFolders: (project_or_id, callback=(error, project) ->) ->
		ProjectGetter._returnProjectIfPassed project_or_id, callback, (err)->
			return callback(err) if err?
			project_id = project_or_id
			excludes = {}
			for i in [1..ProjectGetter.EXCLUDE_DEPTH]
				excludes["rootFolder#{Array(i).join(".folder")}.docs"] = 0
				excludes["rootFolder#{Array(i).join(".folder")}.fileRefs"] = 0
			db.projects.find _id: ObjectId(project_id.toString()), excludes, (error, projects = []) ->
				callback error, projects[0]

	getProject: (query, projection, callback = (error, project) ->) ->
		ProjectGetter._returnProjectIfPassed project_or_id, callback, (err)->
			if typeof query == "string"
				query = _id: ObjectId(query)
			else if query instanceof ObjectId
				query = _id: query
			db.projects.find query, projection, (err, project)->
				if err?
					logger.err err:err, query:query, projection:projection, "error getting project"
					return callback(err)
				callback(null, project?[0])

	populateProjectWithUsers: (project, callback=(error, project) ->) ->
		# eventually this should be in a UserGetter.getUser module
		getUser = (user_id, callback=(error, user) ->) ->
			unless user_id instanceof ObjectId
				user_id = ObjectId(user_id)
			db.users.find _id: user_id, (error, users = []) ->
				callback error, users[0]

		jobs = []
		jobs.push (callback) ->
			getUser project.owner_ref, (error, user) ->
				return callback(error) if error?
				if user?
					project.owner_ref = user
				callback null, project

		readOnly_refs = project.readOnly_refs
		project.readOnly_refs = []
		for readOnly_ref in readOnly_refs
			do (readOnly_ref) ->
				jobs.push (callback) ->
					getUser readOnly_ref, (error, user) ->
						return callback(error) if error?
						if user?
							project.readOnly_refs.push user
						callback null, project
						
		collaberator_refs = project.collaberator_refs
		project.collaberator_refs = []
		for collaberator_ref in collaberator_refs
			do (collaberator_ref) ->
				jobs.push (callback) ->
					getUser collaberator_ref, (error, user) ->
						return callback(error) if error?
						if user?
							project.collaberator_refs.push user
						callback null, project

		async.parallelLimit jobs, 3, (error) -> callback error, project

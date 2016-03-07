mongojs = require("../../infrastructure/mongojs")
db = mongojs.db
ObjectId = mongojs.ObjectId
async = require "async"
Project = require("../../models/Project").Project

module.exports = ProjectGetter =
	EXCLUDE_DEPTH: 8

	getProjectWithoutDocLines: (project_id, callback=(error, project) ->) ->
		excludes = {}
		for i in [1..@EXCLUDE_DEPTH]
			excludes["rootFolder#{Array(i).join(".folder")}.docs.lines"] = 0
		db.projects.find _id: ObjectId(project_id.toString()), excludes, (error, projects = []) ->
			callback error, projects[0]

	getProjectWithOnlyFolders: (project_id, callback=(error, project) ->) ->
		excludes = {}
		for i in [1..@EXCLUDE_DEPTH]
			excludes["rootFolder#{Array(i).join(".folder")}.docs"] = 0
			excludes["rootFolder#{Array(i).join(".folder")}.fileRefs"] = 0
		db.projects.find _id: ObjectId(project_id.toString()), excludes, (error, projects = []) ->
			callback error, projects[0]

	getProject: (query, projection, callback = (error, project) ->) ->
		if typeof query == "string"
			query = _id: ObjectId(query)
		else if query instanceof ObjectId
			query = _id: query
		db.projects.findOne query, projection, callback
	
	findAllUsersProjects: (user_id, fields, callback = (error, ownedProjects, readAndWriteProjects, readOnlyProjects) ->) ->
		CollaboratorsHandler = require "../Collaborators/CollaboratorsHandler"
		Project.find {owner_ref: user_id}, fields, (error, projects) ->
			return callback(error) if error?
			CollaboratorsHandler.getProjectsUserIsMemberOf user_id, fields, (error, readAndWriteProjects, readOnlyProjects) ->
				return callback(error) if error?
				callback null, projects, readAndWriteProjects, readOnlyProjects

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

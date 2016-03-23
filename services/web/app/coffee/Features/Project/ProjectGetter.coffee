mongojs = require("../../infrastructure/mongojs")
db = mongojs.db
ObjectId = mongojs.ObjectId
async = require "async"
Project = require("../../models/Project").Project
logger = require("logger-sharelatex")

module.exports = ProjectGetter =
	EXCLUDE_DEPTH: 8


	getProjectWithoutDocLines: (project_id, callback=(error, project) ->) ->
		excludes = {}
		for i in [1..ProjectGetter.EXCLUDE_DEPTH]
			excludes["rootFolder#{Array(i).join(".folder")}.docs.lines"] = 0
		db.projects.find _id: ObjectId(project_id.toString()), excludes, (error, projects = []) ->
			callback error, projects[0]

	getProjectWithOnlyFolders: (project_id, callback=(error, project) ->) ->
		excludes = {}
		for i in [1..ProjectGetter.EXCLUDE_DEPTH]
			excludes["rootFolder#{Array(i).join(".folder")}.docs"] = 0
			excludes["rootFolder#{Array(i).join(".folder")}.fileRefs"] = 0
		db.projects.find _id: ObjectId(project_id.toString()), excludes, (error, projects = []) ->
			callback error, projects[0]


	getProject: (query, projection, callback = (error, project) ->) ->
		if !query?
			return callback("no query provided")

		if typeof(projection) == "function"
			callback = projection

		if typeof query == "string"
			query = _id: ObjectId(query)
		else if query instanceof ObjectId
			query = _id: query
		else if query?.toString().length == 24 # sometimes mongoose ids are hard to identify, this will catch them
			query = _id:  ObjectId(query.toString())
		else
			err = new Error("malformed get request")
			logger.log query:query, err:err, type:typeof(query), "malformed get request"
			return callback(err)

		db.projects.find query, projection, (err, project)->
			if err?
				logger.err err:err, query:query, projection:projection, "error getting project"
				return callback(err)
			callback(null, project?[0])

	
	findAllUsersProjects: (user_id, fields, callback = (error, ownedProjects, readAndWriteProjects, readOnlyProjects) ->) ->
		CollaboratorsHandler = require "../Collaborators/CollaboratorsHandler"
		Project.find {owner_ref: user_id}, fields, (error, projects) ->
			return callback(error) if error?
			CollaboratorsHandler.getProjectsUserIsCollaboratorOf user_id, fields, (error, readAndWriteProjects, readOnlyProjects) ->
				return callback(error) if error?
				callback null, projects, readAndWriteProjects, readOnlyProjects

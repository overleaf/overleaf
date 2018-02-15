mongojs = require("../../infrastructure/mongojs")
metrics = require("metrics-sharelatex")
db = mongojs.db
ObjectId = mongojs.ObjectId
async = require "async"
Project = require("../../models/Project").Project
logger = require("logger-sharelatex")
LockManager = require("../../infrastructure/LockManager")

module.exports = ProjectGetter =
	EXCLUDE_DEPTH: 8

	getProjectWithoutDocLines: (project_id, callback=(error, project) ->) ->
		excludes = {}
		for i in [1..ProjectGetter.EXCLUDE_DEPTH]
			excludes["rootFolder#{Array(i).join(".folders")}.docs.lines"] = 0
		ProjectGetter.getProject project_id, excludes, callback

	getProjectWithOnlyFolders: (project_id, callback=(error, project) ->) ->
		excludes = {}
		for i in [1..ProjectGetter.EXCLUDE_DEPTH]
			excludes["rootFolder#{Array(i).join(".folders")}.docs"] = 0
			excludes["rootFolder#{Array(i).join(".folders")}.fileRefs"] = 0
		ProjectGetter.getProject project_id, excludes, callback

	getProject: (project_id, projection, callback = (error, project) ->) ->
		if !project_id?
			return callback("no project_id provided")

		if projection?.rootFolder
			LockManager.mongoTransactionLock.runWithLock project_id,
				(cb) -> ProjectGetter.getProjectWithoutLock project_id, projection, cb
				callback
		else
			ProjectGetter.getProjectWithoutLock project_id, projection, callback

	getProjectWithoutLock: (project_id, projection, callback = (error, project) ->) ->
		if typeof(projection) == "function"
			callback = projection

		if typeof project_id == "string"
			query = _id: ObjectId(project_id)
		else if project_id instanceof ObjectId
			query = _id: project_id
		else if project_id?.toString().length == 24 # sometimes mongoose ids are hard to identify, this will catch them
			query = _id:  ObjectId(project_id.toString())
		else
			err = new Error("malformed get request")
			logger.log project_id:project_id, err:err, type:typeof(project_id), "malformed get request"
			return callback(err)

		db.projects.find query, projection, (err, project) ->
			if err?
				logger.err err:err, query:query, projection:projection, "error getting project"
				return callback(err)
			callback(null, project?[0])

	findAllUsersProjects: (
		user_id,
		fields,
		callback = (error, projects={owned: [], readAndWrite: [], readOnly: [], tokenReadAndWrite: [], tokenReadOnly: []}) ->
	) ->
		CollaboratorsHandler = require "../Collaborators/CollaboratorsHandler"
		Project.find {owner_ref: user_id}, fields, (error, ownedProjects) ->
			return callback(error) if error?
			CollaboratorsHandler.getProjectsUserIsMemberOf user_id, fields, (error, projects) ->
				return callback(error) if error?
				result = {
					owned: ownedProjects || [],
					readAndWrite: projects.readAndWrite || [],
					readOnly: projects.readOnly || [],
					tokenReadAndWrite: projects.tokenReadAndWrite || [],
					tokenReadOnly: projects.tokenReadOnly || []
				}
				callback null, result

[
	'getProject',
	'getProjectWithoutDocLines'
].map (method) ->
	metrics.timeAsyncMethod(ProjectGetter, method, 'mongo.ProjectGetter', logger)

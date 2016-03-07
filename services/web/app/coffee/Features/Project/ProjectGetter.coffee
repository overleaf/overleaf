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

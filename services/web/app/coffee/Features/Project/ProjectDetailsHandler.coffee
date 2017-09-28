ProjectGetter = require("./ProjectGetter")
UserGetter = require("../User/UserGetter")
Project = require('../../models/Project').Project
logger = require("logger-sharelatex")
tpdsUpdateSender = require '../ThirdPartyDataStore/TpdsUpdateSender'
_ = require("underscore")
PublicAccessLevels = require("../Authorization/PublicAccessLevels")
Errors = require("../Errors/Errors")

module.exports = ProjectDetailsHandler =
	getDetails: (project_id, callback)->
		ProjectGetter.getProject project_id, {name:true, description:true, compiler:true, features:true, owner_ref:true}, (err, project)->
			if err?
				logger.err err:err, project_id:project_id, "error getting project"
				return callback(err)
			return callback(new Errors.NotFoundError("project not found")) if !project?
			UserGetter.getUser project.owner_ref, (err, user) ->
				return callback(err) if err?
				details =
					name : project.name
					description: project.description
					compiler: project.compiler
					features: user.features
				logger.log project_id:project_id, details:details, "getting project details"
				callback(err, details)

	getProjectDescription: (project_id, callback)->
		Project.findOne _id:project_id, "description", (err, project)->
			callback(err, project?.description)

	setProjectDescription: (project_id, description, callback)->
		conditions = _id:project_id
		update = description:description
		logger.log conditions:conditions, update:update, project_id:project_id, description:description, "setting project description"
		Project.update conditions, update, (err)->
			if err?
				logger.err err:err, "something went wrong setting project description"
			callback(err)

	renameProject: (project_id, newName, callback = ->)->
		ProjectDetailsHandler.validateProjectName newName, (error) ->
			return callback(error) if error?
			logger.log project_id: project_id, newName:newName, "renaming project"
			ProjectGetter.getProject project_id, {name:true}, (err, project)->
				if err? or !project?
					logger.err err:err,  project_id:project_id, "error getting project or could not find it todo project rename"
					return callback(err)
				oldProjectName = project.name
				Project.update _id:project_id, {name: newName}, (err, project)=>
					if err?
						return callback(err)
					tpdsUpdateSender.moveEntity {project_id:project_id, project_name:oldProjectName, newProjectName:newName}, callback

	MAX_PROJECT_NAME_LENGTH: 150
	validateProjectName: (name, callback = (error) ->) ->
		if name.length == 0
			return callback(new Errors.InvalidNameError("Project name cannot be blank"))
		else if name.length > @MAX_PROJECT_NAME_LENGTH
			return callback(new Errors.InvalidNameError("Project name is too long"))
		else if name.indexOf("/") > -1
			return callback(new Errors.InvalidNameError("Project name cannot not contain / characters"))
		else
			return callback()

	setPublicAccessLevel : (project_id, newAccessLevel, callback = ->)->
		logger.log project_id: project_id, level: newAccessLevel, "set public access level"
		# TODO: remove the read-only and read-and-write items from here
		if project_id? && newAccessLevel? and _.include [PublicAccessLevels.READ_ONLY, PublicAccessLevels.READ_AND_WRITE, PublicAccessLevels.PRIVATE, PublicAccessLevels.TOKEN_BASED], newAccessLevel
			Project.update {_id:project_id},{publicAccesLevel:newAccessLevel}, (err)->
				callback()

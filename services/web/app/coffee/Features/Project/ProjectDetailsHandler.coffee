ProjectGetter = require("./ProjectGetter")
UserGetter = require("../User/UserGetter")
Project = require('../../models/Project').Project
logger = require("logger-sharelatex")
tpdsUpdateSender = require '../ThirdPartyDataStore/TpdsUpdateSender'
_ = require("underscore")
PublicAccessLevels = require("../Authorization/PublicAccessLevels")
Errors = require("../Errors/Errors")
ProjectTokenGenerator = require('./ProjectTokenGenerator')

module.exports = ProjectDetailsHandler =
	getDetails: (project_id, callback)->
		ProjectGetter.getProject project_id, {name:true, description:true, compiler:true, features:true, owner_ref:true, overleaf:true}, (err, project)->
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

				if project.overleaf?
					details.overleaf = project.overleaf

				logger.log project_id:project_id, details: details, "getting project details"
				callback(err, details)

	getProjectDescription: (project_id, callback)->
		ProjectGetter.getProject project_id, description: true, (err, project)->
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
		if !name? or name.length == 0
			return callback(new Errors.InvalidNameError("Project name cannot be blank"))
		else if name.length > @MAX_PROJECT_NAME_LENGTH
			return callback(new Errors.InvalidNameError("Project name is too long"))
		else if name.indexOf("/") > -1
			return callback(new Errors.InvalidNameError("Project name cannot not contain / characters"))
		else
			return callback()

	generateUniqueName: (user_id, name, callback = (error, newName) -> ) ->
		timestamp = new Date().toISOString().replace(/T(\d+):(\d+):(\d+)\..*/,' $1$2$3') # strip out unwanted characters
		ProjectDetailsHandler.ensureProjectNameIsUnique user_id, name, [" #{timestamp}"], callback

	_addSuffixToProjectName: (name, suffix = '') ->
		# append the suffix and truncate the project title if needed
		truncatedLength = ProjectDetailsHandler.MAX_PROJECT_NAME_LENGTH - suffix.length
		return name.substr(0, truncatedLength) + suffix

	# FIXME: we should put a lock around this to make it completely safe, but we would need to do that at
	# the point of project creation, rather than just checking the name at the start of the import.
	# If we later move this check into ProjectCreationHandler we can ensure all new projects are created
	# with a unique name.  But that requires thinking through how we would handle incoming projects from
	# dropbox for example.
	ensureProjectNameIsUnique: (user_id, name, suffixes = [], callback = (error, name, changed)->) ->
		ProjectGetter.findAllUsersProjects user_id, {name: 1}, (error, allUsersProjectNames) ->
			return callback(error) if error?
			# allUsersProjectNames is returned as a hash {owned: [name1, name2, ...], readOnly: [....]}
			# collect all of the names and flatten them into a single array
			projectNameList = _.pluck(_.flatten(_.values(allUsersProjectNames)),'name')
			# create a set of all project names
			allProjectNames = new Set()
			for projectName in projectNameList
				allProjectNames.add(projectName)
			isUnique = (x) -> !allProjectNames.has(x)
			# check if the supplied name is already unique
			if isUnique(name)
				return callback(null, name, false)
			# the name already exists, try adding the user-supplied suffixes to generate a unique name
			for suffix in suffixes
				candidateName = ProjectDetailsHandler._addSuffixToProjectName(name, suffix)
				if isUnique(candidateName)
					return callback(null, candidateName, true)
			# we couldn't make the name unique, something is wrong
			return callback new Errors.InvalidNameError("Project name could not be made unique")
	
	fixProjectName: (name) ->
		if name == ""
			name = "Untitled"
		if name.indexOf('/') > -1
			# v2 does not allow / in a project name
			name = name.replace(/\//g, '-')
		if name.length > @MAX_PROJECT_NAME_LENGTH
			name = name.substr(0, @MAX_PROJECT_NAME_LENGTH)
		return name

	setPublicAccessLevel : (project_id, newAccessLevel, callback = ->)->
		logger.log project_id: project_id, level: newAccessLevel, "set public access level"
		# DEPRECATED: `READ_ONLY` and `READ_AND_WRITE` are still valid in, but should no longer
		# be passed here. Remove after token-based access has been live for a while
		if project_id? && newAccessLevel? and _.include [
			PublicAccessLevels.READ_ONLY,
			PublicAccessLevels.READ_AND_WRITE,
			PublicAccessLevels.PRIVATE,
			PublicAccessLevels.TOKEN_BASED
		], newAccessLevel
			Project.update {_id:project_id},{publicAccesLevel:newAccessLevel}, (err)->
				callback(err)

	ensureTokensArePresent: (project_id, callback=(err, tokens)->) ->
		ProjectGetter.getProject project_id, {tokens: 1}, (err, project) ->
			return callback(err) if err?
			if project.tokens? and project.tokens.readOnly? and project.tokens.readAndWrite?
				logger.log {project_id}, "project already has tokens"
				return callback(null, project.tokens)
			else
				logger.log {
					project_id,
					has_tokens: project.tokens?,
					has_readOnly: project?.tokens?.readOnly?,
					has_readAndWrite: project?.tokens?.readAndWrite?
				}, "generating tokens for project"
				tokens = project.tokens || {}
				if !tokens.readOnly?
					tokens.readOnly = ProjectTokenGenerator.readOnlyToken()
				if !tokens.readAndWrite?
					tokens.readAndWrite = ProjectTokenGenerator.readAndWriteToken()
				Project.update {_id: project_id}, {$set: {tokens: tokens}}, (err) ->
					return callback(err) if err?
					callback(null, tokens)

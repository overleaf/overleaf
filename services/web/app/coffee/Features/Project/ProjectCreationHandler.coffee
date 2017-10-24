logger = require('logger-sharelatex')
async = require("async")
metrics = require('metrics-sharelatex')
Settings = require('settings-sharelatex')
ObjectId = require('mongoose').Types.ObjectId
Project = require('../../models/Project').Project
Folder = require('../../models/Folder').Folder
ProjectEntityHandler = require('./ProjectEntityHandler')
ProjectDetailsHandler = require('./ProjectDetailsHandler')
HistoryController = require('../History/HistoryController')
User = require('../../models/User').User
fs = require('fs')
Path = require "path"
_ = require "underscore"

module.exports = ProjectCreationHandler =

	createBlankProject : (owner_id, projectName, callback = (error, project) ->)->
		metrics.inc("project-creation")
		ProjectDetailsHandler.validateProjectName projectName, (error) ->
			return callback(error) if error?
			logger.log owner_id:owner_id, projectName:projectName, "creating blank project"
			HistoryController.initializeProject (error, history) ->
				return callback(error) if error?
				rootFolder = new Folder {'name':'rootFolder'}
				project = new Project
					 owner_ref          : new ObjectId(owner_id)
					 name               : projectName
				if history?.overleaf_id?
					project.overleaf.id = history.overleaf_id
				if Settings.currentImageName?
					project.imageName = Settings.currentImageName
				project.rootFolder[0] = rootFolder
				User.findById owner_id, "ace.spellCheckLanguage", (err, user)->
					project.spellCheckLanguage = user.ace.spellCheckLanguage
					project.save (err)->
						return callback(err) if err?
						callback err, project

	createBasicProject :  (owner_id, projectName, callback = (error, project) ->)->
		self = @
		@createBlankProject owner_id, projectName, (error, project)->
			return callback(error) if error?
			self._buildTemplate "mainbasic.tex", owner_id, projectName, (error, docLines)->
				return callback(error) if error?
				ProjectEntityHandler.addDoc project._id, project.rootFolder[0]._id, "main.tex", docLines, (error, doc)->
					if error?
						logger.err err:error, "error adding doc when creating basic project"
						return callback(error)
					ProjectEntityHandler.setRootDoc project._id, doc._id, (error) ->
						callback(error, project)

	createExampleProject: (owner_id, projectName, callback = (error, project) ->)->
		self = @
		@createBlankProject owner_id, projectName, (error, project)->
			return callback(error) if error?
			async.series [
				(callback) ->
					self._buildTemplate "main.tex", owner_id, projectName, (error, docLines)->
						return callback(error) if error?
						ProjectEntityHandler.addDoc project._id, project.rootFolder[0]._id, "main.tex", docLines, (error, doc)->
							return callback(error) if error?
							ProjectEntityHandler.setRootDoc project._id, doc._id, callback
				(callback) ->
					self._buildTemplate "references.bib", owner_id, projectName, (error, docLines)->
						return callback(error) if error?
						ProjectEntityHandler.addDoc project._id, project.rootFolder[0]._id, "references.bib", docLines, (error, doc)->
							callback(error)
				(callback) ->
					universePath = Path.resolve(__dirname + "/../../../templates/project_files/universe.jpg")
					ProjectEntityHandler.addFile project._id, project.rootFolder[0]._id, "universe.jpg", universePath, callback
			], (error) ->
				callback(error, project)

	_buildTemplate: (template_name, user_id, project_name, callback = (error, output) ->)->
		User.findById user_id, "first_name last_name", (error, user)->
			return callback(error) if error?
			monthNames = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ]

			templatePath = Path.resolve(__dirname + "/../../../templates/project_files/#{template_name}")
			fs.readFile templatePath, (error, template) ->
				return callback(error) if error?
				data =
					project_name: project_name
					user: user
					year: new Date().getUTCFullYear()
					month: monthNames[new Date().getUTCMonth()]
				output = _.template(template.toString(), data)
				callback null, output.split("\n")

metrics.timeAsyncMethod(
	ProjectCreationHandler, 'createBlankProject',
	'mongo.ProjectCreationHandler',
	logger
)



User = require('../models/User').User
Project = require('../models/Project').Project
sanitize = require('validator').sanitize
path = require "path"
logger = require('logger-sharelatex')
_ = require('underscore')
fs = require('fs')
ProjectHandler = require '../handlers/ProjectHandler'
SecurityManager = require '../managers/SecurityManager'
GuidManager = require '../managers/GuidManager'
Settings = require('settings-sharelatex')
projectCreationHandler = require '../Features/Project/ProjectCreationHandler'
projectLocator = require '../Features/Project/ProjectLocator'
projectDuplicator = require('../Features/Project/ProjectDuplicator')
ProjectZipStreamManager = require '../Features/Downloads/ProjectZipStreamManager'
metrics = require('../infrastructure/Metrics')
TagsHandler = require('../Features/Tags/TagsHandler')
SubscriptionLocator = require("../Features/Subscription/SubscriptionLocator")
SubscriptionFormatters = require("../Features/Subscription/SubscriptionFormatters")
FileStoreHandler = require("../Features/FileStore/FileStoreHandler")

module.exports = class ProjectController
	constructor: (@collaberationManager)->
		ProjectHandler = new ProjectHandler()

	list: (req, res, next)->
		timer = new metrics.Timer("project-list")
		user_id = req.session.user._id
		startTime = new Date()
		User.findById user_id, (error, user) ->
			logger.log user_id: user_id, duration: (new Date() - startTime), "project list timer - User.findById"
			startTime = new Date()
			# TODO: Remove this one month after the ability to start free trials was removed
			SubscriptionLocator.getUsersSubscription user._id, (err, subscription)->
				logger.log user_id: user_id, duration: (new Date() - startTime), "project list timer - Subscription.getUsersSubscription"
				startTime = new Date()
				return next(error) if error?
				# TODO: Remove this one month after the ability to start free trials was removed
				if subscription? and subscription.freeTrial? and subscription.freeTrial.expiresAt?
					freeTrial =
						expired: !!subscription.freeTrial.downgraded
						expiresAt: SubscriptionFormatters.formatDate(subscription.freeTrial.expiresAt)
				TagsHandler.getAllTags user_id, (err, tags, tagsGroupedByProject)->
					logger.log user_id: user_id, duration: (new Date() - startTime), "project list timer - TagsHandler.getAllTags"
					startTime = new Date()
					Project.findAllUsersProjects user_id, 'name lastUpdated publicAccesLevel', (projects, collabertions, readOnlyProjects)->
						logger.log user_id: user_id, duration: (new Date() - startTime), "project list timer - Project.findAllUsersProjects"
						startTime = new Date()
						for project in projects
							project.accessLevel = "owner"
						for project in collabertions
							project.accessLevel = "readWrite"
						for project in readOnlyProjects
							project.accessLevel = "readOnly"
						projects = projects.concat(collabertions).concat(readOnlyProjects)
						projects = projects.map (project)->
							project.tags = tagsGroupedByProject[project._id] || []
							return project
						tags = _.sortBy tags, (tag)->
							-tag.project_ids.length
						logger.log projects:projects, collabertions:collabertions, readOnlyProjects:readOnlyProjects, user_id:user_id, "rendering project list"
						sortedProjects = _.sortBy projects, (project)->
							return - project.lastUpdated
						res.render 'project/list',
							title:'Your Projects'
							priority_title: true
							projects: sortedProjects
							freeTrial: freeTrial
							tags:tags
							projectTabActive: true
						logger.log user_id: user_id, duration: (new Date() - startTime), "project list timer - Finished"
						timer.done()

	apiNewProject: (req, res)->
		user = req.session.user
		projectName = sanitize(req.body.projectName).xss()
		template = sanitize(req.body.template).xss()
		logger.log user: user, type: template, name: projectName, "creating project"
		if template == 'example'
			projectCreationHandler.createExampleProject user._id, projectName, (err, project)->
				if err?
					logger.error err: err, project: project, user: user, name: projectName, type: "example", "error creating project"
					res.send 500
				else
					logger.log project: project, user: user, name: projectName, type: "example", "created project"
					res.send {project_id:project._id}
		else
			projectCreationHandler.createBasicProject user._id, projectName, (err, project)->
				if err?
					logger.error err: err, project: project, user: user, name: projectName, type: "basic", "error creating project"
					res.send 500
				else
					logger.log project: project, user: user, name: projectName, type: "basic", "created project"
					res.send {project_id:project._id}
	
	loadEditor: (req, res)->
		timer = new metrics.Timer("load-editor")
		if !Settings.editorIsOpen
			res.render("general/closed", {title:"updating site"})
		else
			if req.session.user?
				user_id = req.session.user._id
			else
				user_id = 'openUser'
			project_id = req.params.Project_id
			Project.findPopulatedById project_id, (err, project)->
				User.findById user_id, (err, user)->
					if user_id == 'openUser'
						anonymous = true
						user =
							id : user_id
							ace:
								mode:'none'
								theme:'textmate'
								fontSize: '12'
								autoComplete: true
								spellCheckLanguage: ""
								pdfViewer: ""
							subscription:
								freeTrial:
									allowed: true
							featureSwitches:
								dropbox: false
								longPolling: false
					else
						anonymous = false
					SubscriptionLocator.getUsersSubscription user._id, (err, subscription)->
						SecurityManager.userCanAccessProject user, project, (canAccess, privlageLevel)->
							allowedFreeTrial = true
							if subscription? and subscription.freeTrial? and subscription.freeTrial.expiresAt?
								allowedFreeTrial = !!subscription.freeTrial.allowed
							if canAccess
								timer.done()
								res.render 'project/editor',
									title:  project.name
									priority_title: true
									bodyClasses: ["editor"]
									project : project
									owner : project.owner_ref
									userObject : JSON.stringify({
										id    : user.id
										email : user.email
										first_name : user.first_name
										last_name  : user.last_name
										referal_id : user.referal_id
										subscription :
											freeTrial: {allowed: allowedFreeTrial}
									})
									userSettingsObject: JSON.stringify({
										mode  : user.ace.mode
										theme : user.ace.theme
										project_id : project._id
										fontSize : user.ace.fontSize
										autoComplete: user.ace.autoComplete
										spellCheckLanguage: user.ace.spellCheckLanguage
										pdfViewer : user.ace.pdfViewer
										docPositions: {}
										longPolling: user.featureSwitches.longPolling
									})
									sharelatexObject : JSON.stringify({
										siteUrl: Settings.siteUrl,
										jsPath: res.locals.jsPath
									})
									privlageLevel: privlageLevel
									userCanSeeDropbox: user.featureSwitches.dropbox and project.owner_ref._id+"" == user._id+""
									loadPdfjs: (user.ace.pdfViewer == "pdfjs")
									chatUrl: Settings.apis.chat.url
									anonymous: anonymous
									languages: Settings.languages,

	startBufferingRequest: (req, res, next) ->
		req.bufferedChunks = []
		req.endEmitted = false
		bufferChunk = (chunk) -> req.bufferedChunks.push(chunk)
		req.on "data", bufferChunk
		endCallback = () -> req.endEmitted = true
		req.on "end", endCallback
		req.emitBufferedData = () ->
			logger.log chunks: @bufferedChunks.length, emittedEnd: @endEmitted, "emitting buffer chunks"
			@removeListener "data", bufferChunk
			while @bufferedChunks.length > 0
				@emit "data", @bufferedChunks.shift()
			@removeListener "end", endCallback
			@emit "end" if @endEmitted
		next()

	downloadImageFile : (req, res)->
		project_id = req.params.Project_id
		file_id = req.params.File_id
		queryString = req.query
		logger.log project_id: project_id, file_id: file_id, queryString:queryString, "file download"
		res.setHeader("Content-Disposition", "attachment")
		FileStoreHandler.getFileStream project_id, file_id, queryString, (err, stream)->
			stream.pipe res

	cloneProject: (req, res)->
		metrics.inc "cloned-project"
		project_id = req.params.Project_id
		projectName = req.body.projectName
		logger.log project_id:project_id, projectName:projectName, "cloning project"
		if !req.session.user?
			return res.send redir:"/register"
		projectDuplicator.duplicate req.session.user, project_id, projectName, (err, project)->
			if err?
				logger.error err:err, project_id: project_id, user_id: req.session.user._id, "error cloning project"
				return next(err)
			res.send(project_id:project._id)

	deleteProject: (req, res)->
		project_id = req.params.Project_id
		logger.log project_id:project_id, "deleting project"
		ProjectHandler.deleteProject project_id, (err)->
			if err?
				res.send 500
			else
				res.send 200



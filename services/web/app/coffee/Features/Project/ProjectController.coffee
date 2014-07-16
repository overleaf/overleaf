async = require("async")
logger = require("logger-sharelatex")
projectDeleter = require("./ProjectDeleter")
projectDuplicator = require("./ProjectDuplicator")
projectCreationHandler = require("./ProjectCreationHandler")
editorController = require("../Editor/EditorController")
metrics = require('../../infrastructure/Metrics')
sanitize = require('sanitizer')
Project = require('../../models/Project').Project
User = require('../../models/User').User
TagsHandler = require("../Tags/TagsHandler")
SubscriptionLocator = require("../Subscription/SubscriptionLocator")
_ = require("underscore")
Settings = require("settings-sharelatex")
SecurityManager = require("../../managers/SecurityManager")
fs = require "fs"

module.exports = ProjectController =

	updateProjectSettings: (req, res, next) ->
		project_id = req.params.Project_id

		jobs = []

		if req.body.compiler?
			jobs.push (callback) ->
				editorController.setCompiler project_id, req.body.compiler, callback

		if req.body.name?
			jobs.push (callback) ->
				editorController.renameProject project_id, req.body.name, callback

		if req.body.spellCheckLanguage?
			jobs.push (callback) ->
				editorController.setSpellCheckLanguage project_id, req.body.spellCheckLanguage, callback

		if req.body.rootDocId?
			jobs.push (callback) ->
				editorController.setRootDoc project_id, req.body.rootDocId, callback

		if req.body.publicAccessLevel?
			jobs.push (callback) ->
				editorController.setPublicAccessLevel project_id, req.body.publicAccessLevel, callback

		async.series jobs, (error) ->
			return next(error) if error?
			res.send(204)

	deleteProject: (req, res) ->
		project_id = req.params.Project_id
		forever    = req.query?.forever?
		logger.log project_id: project_id, forever: forever, "received request to delete project"

		if forever
			doDelete = projectDeleter.deleteProject
		else
			doDelete = projectDeleter.archiveProject

		doDelete project_id, (err)->
			if err?
				res.send 500
			else
				res.send 200

	restoreProject: (req, res) ->
		project_id = req.params.Project_id
		logger.log project_id:project_id, "received request to restore project"
		projectDeleter.restoreProject project_id, (err)->
			if err?
				res.send 500
			else
				res.send 200

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


	newProject: (req, res)->
		user = req.session.user
		projectName = req.body.projectName?.trim()
		template = req.body.template
		logger.log user: user, type: template, name: projectName, "creating project"
		async.waterfall [
			(cb)->
				if template == 'example'
					projectCreationHandler.createExampleProject user._id, projectName, cb
				else
					projectCreationHandler.createBasicProject user._id, projectName, cb
		], (err, project)->
			if err?
				logger.error err: err, project: project, user: user, name: projectName, type: template, "error creating project"
				res.send 500
			else
				logger.log project: project, user: user, name: projectName, type: template, "created project"
				res.send {project_id:project._id}


	renameProject: (req, res)->
		project_id = req.params.Project_id
		newName = req.body.newProjectName
		editorController.renameProject project_id, newName, (err)->
			if err?
				logger.err err:err, project_id:project_id, newName:newName, "problem renaming project"
				res.send 500
			else
				res.send 200

	projectListPage: (req, res, next)->
		timer = new metrics.Timer("project-list")
		user_id = req.session.user._id
		async.parallel {
			tags: (cb)->
				TagsHandler.getAllTags user_id, cb
			projects: (cb)->
				Project.findAllUsersProjects user_id, 'name lastUpdated publicAccesLevel archived owner_ref', cb
			subscription: (cb)->
				SubscriptionLocator.getUsersSubscription user_id, cb
			}, (err, results)->
				if err?
					logger.err err:err, "error getting data for project list page"
					return next(err)
				logger.log results:results, user_id:user_id, "rendering project list"
				tags = results.tags[0]
				projects = ProjectController._buildProjectList results.projects[0], results.projects[1], results.projects[2]
				ProjectController._injectProjectOwners projects, (error, projects) ->
					return next(error) if error?

					viewModel = {
						title:'Your Projects'
						priority_title: true
						projects: projects
						tags: tags
						hasSubscription: !!results.subscription
					}

					if Settings?.algolia?.app_id? and Settings?.algolia?.read_only_api_key?
						viewModel.showUserDetailsArea = true
						viewModel.algolia_api_key = Settings.algolia.api_key
						viewModel.algolia_app_id = Settings.algolia.app_id
					else
						viewModel.showUserDetailsArea = false

					res.render 'project/list', viewModel
					timer.done()


	loadEditor: (req, res, next)->
		timer = new metrics.Timer("load-editor")
		if !Settings.editorIsOpen
			return res.render("general/closed", {title:"updating site"})

		if req.session.user?
			user_id = req.session.user._id 
			anonymous = false
		else
			anonymous = true
			user_id = 'openUser'
		
		project_id = req.params.Project_id
	
		async.parallel {
			project: (cb)->
				Project.findPopulatedById project_id, cb
			user: (cb)->
				if user_id == 'openUser'
					cb null, defaultSettingsForAnonymousUser(user_id)
				else
					User.findById user_id, cb
			subscription: (cb)->
				if user_id == 'openUser'
					return cb()
				SubscriptionLocator.getUsersSubscription user_id, cb
		}, (err, results)->
			if err?
				logger.err err:err, "error getting details for project page"
				return next err
			project = results.project
			user = results.user
			subscription = results.subscription

			SecurityManager.userCanAccessProject user, project, (canAccess, privilegeLevel)->
				if !canAccess
					return res.send 401

				if subscription? and subscription.freeTrial? and subscription.freeTrial.expiresAt?
					allowedFreeTrial = !!subscription.freeTrial.allowed || true

				res.render 'project/editor',
					title:  project.name
					priority_title: true
					bodyClasses: ["editor"]
					project : project
					project_id : project._id
					user : {
						id    : user.id
						email : user.email
						first_name : user.first_name
						last_name  : user.last_name
						referal_id : user.referal_id
						subscription :
							freeTrial: {allowed: allowedFreeTrial}
					}
					userSettings: {
						mode  : user.ace.mode
						theme : user.ace.theme
						fontSize : user.ace.fontSize
						autoComplete: user.ace.autoComplete
						pdfViewer : user.ace.pdfViewer
					}
					privilegeLevel: privilegeLevel
					chatUrl: Settings.apis.chat.url
					anonymous: anonymous
					languages: Settings.languages
					themes: THEME_LIST
					timer.done()

	_buildProjectList: (ownedProjects, sharedProjects, readOnlyProjects)->
		projects = []
		for project in ownedProjects
			projects.push ProjectController._buildProjectViewModel(project, "owner")
		for project in sharedProjects
			projects.push ProjectController._buildProjectViewModel(project, "readWrite")
		for project in readOnlyProjects
			projects.push ProjectController._buildProjectViewModel(project, "readOnly")

		return projects

	_buildProjectViewModel: (project, accessLevel) ->
		{
			id: project._id
			name: project.name
			lastUpdated: project.lastUpdated
			publicAccessLevel: project.publicAccesLevel
			accessLevel: accessLevel
			archived: !!project.archived
			owner_ref: project.owner_ref
		}

	_injectProjectOwners: (projects, callback = (error, projects) ->) ->
		users = {}
		for project in projects
			if project.owner_ref?
				users[project.owner_ref.toString()] = true

		jobs = []
		for user_id, _ of users
			do (user_id) ->
				jobs.push (callback) ->
					User.findById user_id, "first_name last_name", (error, user) ->
						return callback(error) if error?
						users[user_id] = user
						callback()

		async.series jobs, (error) ->
			for project in projects
				if project.owner_ref?
					project.owner = users[project.owner_ref.toString()]
			callback null, projects

defaultSettingsForAnonymousUser = (user_id)->
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
		trackChanges: false

THEME_LIST = []
do generateThemeList = () ->
	files = fs.readdirSync __dirname + '/../../../../public/js/ace'
	for file in files
		if file.slice(-2) == "js" and file.match(/^theme-/)
			cleanName = file.slice(0,-3).slice(6)
			THEME_LIST.push cleanName


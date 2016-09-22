async = require("async")
logger = require("logger-sharelatex")
projectDeleter = require("./ProjectDeleter")
projectDuplicator = require("./ProjectDuplicator")
projectCreationHandler = require("./ProjectCreationHandler")
editorController = require("../Editor/EditorController")
metrics = require('../../infrastructure/Metrics')
User = require('../../models/User').User
TagsHandler = require("../Tags/TagsHandler")
SubscriptionLocator = require("../Subscription/SubscriptionLocator")
NotificationsHandler = require("../Notifications/NotificationsHandler")
LimitationsManager = require("../Subscription/LimitationsManager")
_ = require("underscore")
Settings = require("settings-sharelatex")
AuthorizationManager = require("../Authorization/AuthorizationManager")
fs = require "fs"
InactiveProjectManager = require("../InactiveData/InactiveProjectManager")
ProjectUpdateHandler = require("./ProjectUpdateHandler")
ProjectGetter = require("./ProjectGetter")
PrivilegeLevels = require("../Authorization/PrivilegeLevels")
AuthenticationController = require("../Authentication/AuthenticationController")
PackageVersions = require("../../infrastructure/PackageVersions")

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

		async.series jobs, (error) ->
			return next(error) if error?
			res.sendStatus(204)

	updateProjectAdminSettings: (req, res, next) ->
		project_id = req.params.Project_id

		jobs = []
		if req.body.publicAccessLevel?
			jobs.push (callback) ->
				editorController.setPublicAccessLevel project_id, req.body.publicAccessLevel, callback

		async.series jobs, (error) ->
			return next(error) if error?
			res.sendStatus(204)

	deleteProject: (req, res) ->
		project_id = req.params.Project_id
		forever    = req.query?.forever?
		logger.log project_id: project_id, forever: forever, "received request to archive project"

		if forever
			doDelete = projectDeleter.deleteProject
		else
			doDelete = projectDeleter.archiveProject

		doDelete project_id, (err)->
			if err?
				res.sendStatus 500
			else
				res.sendStatus 200

	restoreProject: (req, res) ->
		project_id = req.params.Project_id
		logger.log project_id:project_id, "received request to restore project"
		projectDeleter.restoreProject project_id, (err)->
			if err?
				res.sendStatus 500
			else
				res.sendStatus 200

	cloneProject: (req, res, next)->
		metrics.inc "cloned-project"
		project_id = req.params.Project_id
		projectName = req.body.projectName
		logger.log project_id:project_id, projectName:projectName, "cloning project"
		if !AuthenticationController.isUserLoggedIn(req)
			return res.send redir:"/register"
		currentUser = AuthenticationController.getSessionUser(req)
		projectDuplicator.duplicate currentUser, project_id, projectName, (err, project)->
			if err?
				logger.error err:err, project_id: project_id, user_id: currentUser._id, "error cloning project"
				return next(err)
			res.send(project_id:project._id)


	newProject: (req, res)->
		user_id = AuthenticationController.getLoggedInUserId(req)
		projectName = req.body.projectName?.trim()
		template = req.body.template
		logger.log user: user_id, projectType: template, name: projectName, "creating project"
		async.waterfall [
			(cb)->
				if template == 'example'
					projectCreationHandler.createExampleProject user_id, projectName, cb
				else
					projectCreationHandler.createBasicProject user_id, projectName, cb
		], (err, project)->
			if err?
				logger.error err: err, project: project, user: user_id, name: projectName, templateType: template, "error creating project"
				res.sendStatus 500
			else
				logger.log project: project, user: user_id, name: projectName, templateType: template, "created project"
				res.send {project_id:project._id}


	renameProject: (req, res)->
		project_id = req.params.Project_id
		newName = req.body.newProjectName
		if newName.length > 150
			return res.sendStatus 400
		editorController.renameProject project_id, newName, (err)->
			if err?
				logger.err err:err, project_id:project_id, newName:newName, "problem renaming project"
				res.sendStatus 500
			else
				res.sendStatus 200

	projectListPage: (req, res, next)->
		timer = new metrics.Timer("project-list")
		user_id = AuthenticationController.getLoggedInUserId(req)
		currentUser = AuthenticationController.getSessionUser(req)
		async.parallel {
			tags: (cb)->
				TagsHandler.getAllTags user_id, cb
			notifications: (cb)->
				NotificationsHandler.getUserNotifications user_id, cb
			projects: (cb)->
				ProjectGetter.findAllUsersProjects user_id, 'name lastUpdated publicAccesLevel archived owner_ref', cb
			hasSubscription: (cb)->
				LimitationsManager.userHasSubscriptionOrIsGroupMember currentUser, cb
			user: (cb) ->
				User.findById user_id, "featureSwitches", cb
			}, (err, results)->
				if err?
					logger.err err:err, "error getting data for project list page"
					return next(err)
				logger.log results:results, user_id:user_id, "rendering project list"
				tags = results.tags[0]
				notifications = require("underscore").map results.notifications, (notification)->
					notification.html = req.i18n.translate(notification.templateKey, notification.messageOpts)
					return notification
				projects = ProjectController._buildProjectList results.projects[0], results.projects[1], results.projects[2]
				user = results.user
				ProjectController._injectProjectOwners projects, (error, projects) ->
					return next(error) if error?

					viewModel = {
						title:'your_projects'
						priority_title: true
						projects: projects
						tags: tags
						notifications: notifications or []
						user: user
						hasSubscription: results.hasSubscription[0]
					}

					if Settings?.algolia?.app_id? and Settings?.algolia?.read_only_api_key?
						viewModel.showUserDetailsArea = true
						viewModel.algolia_api_key = Settings.algolia.read_only_api_key
						viewModel.algolia_app_id = Settings.algolia.app_id
					else
						viewModel.showUserDetailsArea = false

					res.render 'project/list', viewModel
					timer.done()


	loadEditor: (req, res, next)->
		timer = new metrics.Timer("load-editor")
		if !Settings.editorIsOpen
			return res.render("general/closed", {title:"updating_site"})

		if AuthenticationController.isUserLoggedIn(req)
			user_id = AuthenticationController.getLoggedInUserId(req)
			anonymous = false
		else
			anonymous = true
			user_id = null

		project_id = req.params.Project_id
		logger.log project_id:project_id, "loading editor"

		async.parallel {
			project: (cb)->
				ProjectGetter.getProject project_id, { name: 1, lastUpdated: 1}, cb
			user: (cb)->
				if !user_id?
					cb null, defaultSettingsForAnonymousUser(user_id)
				else
					User.findById user_id, (err, user)->
						logger.log project_id:project_id, user_id:user_id, "got user"
						cb err, user
			subscription: (cb)->
				if !user_id?
					return cb()
				SubscriptionLocator.getUsersSubscription user_id, cb
			activate: (cb)->
				InactiveProjectManager.reactivateProjectIfRequired project_id, cb
			markAsOpened: (cb)->
				#don't need to wait for this to complete
				ProjectUpdateHandler.markAsOpened project_id, ->
				cb()
		}, (err, results)->
			if err?
				logger.err err:err, "error getting details for project page"
				return next err
			project = results.project
			user = results.user
			subscription = results.subscription


			daysSinceLastUpdated =  (new Date() - project.lastUpdated) /86400000
			logger.log project_id:project_id, daysSinceLastUpdated:daysSinceLastUpdated, "got db results for loading editor"

			AuthorizationManager.getPrivilegeLevelForProject user_id, project_id, (error, privilegeLevel)->
				return next(error) if error?
				if !privilegeLevel? or privilegeLevel == PrivilegeLevels.NONE
					return res.sendStatus 401

				if subscription? and subscription.freeTrial? and subscription.freeTrial.expiresAt?
					allowedFreeTrial = !!subscription.freeTrial.allowed || true

				logger.log project_id:project_id, "rendering editor page"
				res.render 'project/editor',
					title:  project.name
					priority_title: true
					bodyClasses: ["editor"]
					project_id : project._id
					user : {
						id    : user_id
						email : user.email
						first_name : user.first_name
						last_name  : user.last_name
						referal_id : user.referal_id
						signUpDate : user.signUpDate
						subscription :
							freeTrial: {allowed: allowedFreeTrial}
						featureSwitches: user.featureSwitches
						features: user.features
						refProviders: user.refProviders
						betaProgram: user.betaProgram
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
					maxDocLength: Settings.max_doc_length
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
		github: false

THEME_LIST = []
do generateThemeList = () ->
	files = fs.readdirSync __dirname + '/../../../../public/js/' + PackageVersions.lib('ace')
	for file in files
		if file.slice(-2) == "js" and file.match(/^theme-/)
			cleanName = file.slice(0,-3).slice(6)
			THEME_LIST.push cleanName

async = require("async")
logger = require("logger-sharelatex")
projectDeleter = require("./ProjectDeleter")
projectDuplicator = require("./ProjectDuplicator")
projectCreationHandler = require("./ProjectCreationHandler")
editorController = require("../Editor/EditorController")
metrics = require('metrics-sharelatex')
User = require('../../models/User').User
TagsHandler = require("../Tags/TagsHandler")
SubscriptionLocator = require("../Subscription/SubscriptionLocator")
NotificationsHandler = require("../Notifications/NotificationsHandler")
LimitationsManager = require("../Subscription/LimitationsManager")
underscore = require("underscore")
Settings = require("settings-sharelatex")
AuthorizationManager = require("../Authorization/AuthorizationManager")
fs = require "fs"
InactiveProjectManager = require("../InactiveData/InactiveProjectManager")
ProjectUpdateHandler = require("./ProjectUpdateHandler")
ProjectGetter = require("./ProjectGetter")
PrivilegeLevels = require("../Authorization/PrivilegeLevels")
AuthenticationController = require("../Authentication/AuthenticationController")
PackageVersions = require("../../infrastructure/PackageVersions")
AnalyticsManager = require "../Analytics/AnalyticsManager"
Sources = require "../Authorization/Sources"
TokenAccessHandler = require '../TokenAccess/TokenAccessHandler'
CollaboratorsHandler = require '../Collaborators/CollaboratorsHandler'
Modules = require '../../infrastructure/Modules'
ProjectEntityHandler = require './ProjectEntityHandler'
UserGetter = require("../User/UserGetter")
NotificationsBuilder = require("../Notifications/NotificationsBuilder")
crypto = require 'crypto'
{ V1ConnectionError } = require '../Errors/Errors'
Features = require('../../infrastructure/Features')
BrandVariationsHandler = require("../BrandVariations/BrandVariationsHandler")
{ getUserAffiliations } = require("../Institutions/InstitutionsAPI")
V1Handler = require "../V1/V1Handler"

module.exports = ProjectController =

	_isInPercentageRollout: (rolloutName, objectId, percentage) ->
		if Settings.bypassPercentageRollouts == true
			return true
		data = "#{rolloutName}:#{objectId.toString()}"
		md5hash = crypto.createHash('md5').update(data).digest('hex')
		counter = parseInt(md5hash.slice(26, 32), 16)
		return (counter % 100) < percentage

	updateProjectSettings: (req, res, next) ->
		project_id = req.params.Project_id

		jobs = []

		if req.body.compiler?
			jobs.push (callback) ->
				editorController.setCompiler project_id, req.body.compiler, callback

		if req.body.imageName?
			jobs.push (callback) ->
				editorController.setImageName project_id, req.body.imageName, callback

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


	newProject: (req, res, next)->
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
			return next(err) if err?
			logger.log project: project, user: user_id, name: projectName, templateType: template, "created project"
			res.send {project_id:project._id}


	renameProject: (req, res, next)->
		project_id = req.params.Project_id
		newName = req.body.newProjectName
		editorController.renameProject project_id, newName, (err)->
			return next(err) if err?
			res.sendStatus 200

	userProjectsJson: (req, res, next) ->
		user_id = AuthenticationController.getLoggedInUserId(req)
		ProjectGetter.findAllUsersProjects user_id,
			'name lastUpdated publicAccesLevel archived owner_ref tokens', (err, projects) ->
				return next(err) if err?
				projects = ProjectController._buildProjectList(projects)
					.filter((p) -> !p.archived)
					.filter((p) -> !p.isV1Project)
					.map((p) -> {_id: p.id, name: p.name, accessLevel: p.accessLevel})

				res.json({projects: projects})

	projectEntitiesJson: (req, res, next) ->
		user_id = AuthenticationController.getLoggedInUserId(req)
		project_id = req.params.Project_id
		ProjectGetter.getProject project_id, (err, project) ->
			return next(err) if err?
			ProjectEntityHandler.getAllEntitiesFromProject project, (err, docs, files) ->
				return next(err) if err?
				entities = docs.concat(files)
					.sort (a, b) -> a.path > b.path  # Sort by path ascending
					.map (e) -> {
						path: e.path,
						type: if e.doc? then 'doc' else 'file'
					}
				res.json({project_id: project_id, entities: entities})

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
				ProjectGetter.findAllUsersProjects user_id, 'name lastUpdated publicAccesLevel archived owner_ref tokens', cb
			v1Projects: (cb) ->
				Modules.hooks.fire "findAllV1Projects", user_id, (error, projects = []) ->
					if error? and error instanceof V1ConnectionError
						return cb(null, projects: [], tags: [], noConnection: true)
					return cb(error, projects[0]) # hooks.fire returns an array of results, only need first
			hasSubscription: (cb)->
				LimitationsManager.hasPaidSubscription currentUser, (error, hasPaidSubscription) ->
					if error? and error instanceof V1ConnectionError
						return cb(null, true)
					return cb(error, hasPaidSubscription)
			user: (cb) ->
				User.findById user_id, "featureSwitches overleaf awareOfV2 features", cb
			userAffiliations: (cb) ->
				getUserAffiliations user_id, cb
			}, (err, results)->
				if err?
					logger.err err:err, "error getting data for project list page"
					return next(err)
				logger.log results:results, user_id:user_id, "rendering project list"
				v1Tags = results.v1Projects?.tags or []
				tags = results.tags[0].concat(v1Tags)
				notifications = require("underscore").map results.notifications, (notification)->
					notification.html = req.i18n.translate(notification.templateKey, notification.messageOpts)
					return notification
				portalTemplates = ProjectController._buildPortalTemplatesList results.userAffiliations
				projects = ProjectController._buildProjectList results.projects, results.v1Projects?.projects
				user = results.user
				userAffiliations = results.userAffiliations
				warnings = ProjectController._buildWarningsList results.v1Projects

				# in v2 add notifications for matching university IPs
				if Settings.overleaf?
					UserGetter.getUser user_id, { 'lastLoginIp': 1 }, (error, user) ->
						if req.ip != user.lastLoginIp
							NotificationsBuilder.ipMatcherAffiliation(user._id, req.ip).create()

				ProjectController._injectProjectOwners projects, (error, projects) ->
					return next(error) if error?
					viewModel = {
						title:'your_projects'
						priority_title: true
						projects: projects
						tags: tags
						notifications: notifications or []
						portalTemplates: portalTemplates
						user: user
						userAffiliations: userAffiliations
						hasSubscription: results.hasSubscription
						isShowingV1Projects: results.v1Projects?
						warnings: warnings
					}

					if Settings?.algolia?.app_id? and Settings?.algolia?.read_only_api_key?
						viewModel.showUserDetailsArea = true
						viewModel.algolia_api_key = Settings.algolia.read_only_api_key
						viewModel.algolia_app_id = Settings.algolia.app_id
					else
						viewModel.showUserDetailsArea = false

					paidUser = user.features?.github and user.features?.dropbox # use a heuristic for paid account
					freeUserProportion = 0.10
					sampleFreeUser = parseInt(user._id.toString().slice(-2), 16) < freeUserProportion * 255
					showFrontWidget = paidUser or sampleFreeUser
					logger.log {paidUser, sampleFreeUser, showFrontWidget}, 'deciding whether to show front widget'
					if showFrontWidget
						viewModel.frontChatWidgetRoomId = Settings.overleaf?.front_chat_widget_room_id

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
		logger.log project_id:project_id, anonymous:anonymous, user_id:user_id, "loading editor"

		async.auto {
			project: (cb)->
				ProjectGetter.getProject(
					project_id,
					{ name: 1, lastUpdated: 1, track_changes: 1, owner_ref: 1, brandVariationId: 1, overleaf: 1, tokens: 1 },
					(err, project) ->
						return cb(err) if err?
						return cb(null, project) unless project.overleaf?.id? and project.tokens?.readAndWrite? and Settings.projectImportingCheckMaxCreateDelta?
						createDelta = (new Date().getTime() - new Date(project._id.getTimestamp()).getTime()) / 1000
						return cb(null, project) unless createDelta < Settings.projectImportingCheckMaxCreateDelta
						V1Handler.getDocExported project.tokens.readAndWrite, (err, doc_exported) ->
							return next err if err?
							project.exporting = doc_exported.exporting
							cb(null, project)
				)
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
			isTokenMember: (cb) ->
				cb = underscore.once(cb)
				if !user_id?
					return cb()
				CollaboratorsHandler.userIsTokenMember user_id, project_id, cb
			brandVariation: [ "project", (cb, results) ->
				if !results.project?.brandVariationId?
					return cb()
				BrandVariationsHandler.getBrandVariationById results.project.brandVariationId, (error, brandVariationDetails) ->
					cb(error, brandVariationDetails)
			]
		}, (err, results)->
			if err?
				logger.err err:err, "error getting details for project page"
				return next err
			project = results.project
			user = results.user
			subscription = results.subscription
			brandVariation = results.brandVariation

			daysSinceLastUpdated =  (new Date() - project.lastUpdated) / 86400000
			logger.log project_id:project_id, daysSinceLastUpdated:daysSinceLastUpdated, "got db results for loading editor"

			token = TokenAccessHandler.getRequestToken(req, project_id)
			isTokenMember = results.isTokenMember
			AuthorizationManager.getPrivilegeLevelForProject user_id, project_id, token, (error, privilegeLevel)->
				return next(error) if error?
				if !privilegeLevel? or privilegeLevel == PrivilegeLevels.NONE
					return res.sendStatus 401

				if project.exporting
					res.render 'project/importing',
						bodyClasses: ["editor"]
					return

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
						editorTheme : user.ace.theme
						fontSize : user.ace.fontSize
						autoComplete: user.ace.autoComplete
						autoPairDelimiters: user.ace.autoPairDelimiters
						pdfViewer : user.ace.pdfViewer
						syntaxValidation: user.ace.syntaxValidation
						fontFamily: user.ace.fontFamily
						lineHeight: user.ace.lineHeight
						overallTheme: user.ace.overallTheme
					}
					trackChangesState: project.track_changes
					privilegeLevel: privilegeLevel
					chatUrl: Settings.apis.chat.url
					anonymous: anonymous
					anonymousAccessToken: req._anonymousAccessToken
					isTokenMember: isTokenMember
					languages: Settings.languages
					editorThemes: THEME_LIST
					maxDocLength: Settings.max_doc_length
					useV2History: !!project.overleaf?.history?.display
					richTextEnabled: Features.hasFeature('rich-text')
					showTestControls: req.query?.tc == 'true' || user.isAdmin
					brandVariation: brandVariation
					allowedImageNames: Settings.allowedImageNames || []
					gitBridgePublicBaseUrl: Settings.gitBridgePublicBaseUrl
				timer.done()

	_buildProjectList: (allProjects, v1Projects = [])->
		{owned, readAndWrite, readOnly, tokenReadAndWrite, tokenReadOnly} = allProjects
		projects = []
		for project in owned
			projects.push ProjectController._buildProjectViewModel(project, "owner", Sources.OWNER)
		# Invite-access
		for project in readAndWrite
			projects.push ProjectController._buildProjectViewModel(project, "readWrite", Sources.INVITE)
		for project in readOnly
			projects.push ProjectController._buildProjectViewModel(project, "readOnly", Sources.INVITE)
		for project in v1Projects
			projects.push ProjectController._buildV1ProjectViewModel(project)
		# Token-access
		#   Only add these projects if they're not already present, this gives us cascading access
		#   from 'owner' => 'token-read-only'
		for project in tokenReadAndWrite
			if projects.filter((p) -> p.id.toString() == project._id.toString()).length == 0
				projects.push ProjectController._buildProjectViewModel(project, "readAndWrite", Sources.TOKEN)
		for project in tokenReadOnly
			if projects.filter((p) -> p.id.toString() == project._id.toString()).length == 0
				projects.push ProjectController._buildProjectViewModel(project, "readOnly", Sources.TOKEN)

		return projects

	_buildProjectViewModel: (project, accessLevel, source) ->
		TokenAccessHandler.protectTokens(project, accessLevel)
		model = {
			id: project._id
			name: project.name
			lastUpdated: project.lastUpdated
			publicAccessLevel: project.publicAccesLevel
			accessLevel: accessLevel
			source: source
			archived: !!project.archived
			owner_ref: project.owner_ref
			tokens: project.tokens
			isV1Project: false
		}
		return model

	_buildV1ProjectViewModel: (project) ->
		projectViewModel = {
			id: project.id
			name: project.title
			lastUpdated: new Date(project.updated_at * 1000) # Convert from epoch
			archived: project.removed || project.archived
			isV1Project: true
		}
		if (project.owner? and project.owner.user_is_owner) or (project.creator? and project.creator.user_is_creator)
			projectViewModel.accessLevel = "owner"
		else
			projectViewModel.accessLevel = "readOnly"
		if project.owner?
			projectViewModel.owner = {
				first_name: project.owner.name
			}
		else if project.creator?
			projectViewModel.owner = {
				first_name: project.creator.name
			}
		return projectViewModel


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

	_buildWarningsList: (v1ProjectData = {}) ->
		warnings = []
		if v1ProjectData.noConnection
			warnings.push 'No V1 Connection'
		if v1ProjectData.hasHiddenV1Projects
			warnings.push "Looks like you've got a lot of V1 projects! Some of them may be hidden on V2. To view them all, use the V1 dashboard."
		return warnings

	_buildPortalTemplatesList: (affiliations = []) ->
			portalTemplates = []
			for aff in affiliations
				if aff.portal && aff.portal.slug && aff.portal.templates_count && aff.portal.templates_count > 0
					portalPath = if aff.institution.isUniversity then '/edu/' else '/org/'
					portalTemplates.push({
						name: aff.institution.name
						url: Settings.siteUrl + portalPath + aff.portal.slug
					})
			return portalTemplates

defaultSettingsForAnonymousUser = (user_id)->
	id : user_id
	ace:
		mode:'none'
		theme:'textmate'
		fontSize: '12'
		autoComplete: true
		spellCheckLanguage: ""
		pdfViewer: ""
		syntaxValidation: true
	subscription:
		freeTrial:
			allowed: true
	featureSwitches:
		github: false

THEME_LIST = []
do generateThemeList = () ->
	files = fs.readdirSync __dirname + '/../../../../public/js/' + PackageVersions.lib('ace')
	for file in files
		if file.slice(-2) == "js" and /^theme-/.test(file)
			cleanName = file.slice(0,-3).slice(6)
			THEME_LIST.push cleanName

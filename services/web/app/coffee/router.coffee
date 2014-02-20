UserController = require('./controllers/UserController')
AdminController = require('./controllers/AdminController')
HomeController = require('./controllers/HomeController')
ProjectController = require("./controllers/ProjectController")
ProjectApiController = require("./Features/Project/ProjectApiController")
InfoController = require('./controllers/InfoController')
SpellingController = require('./Features/Spelling/SpellingController')
CollaberationManager = require('./managers/CollaberationManager')
SecutiryManager = require('./managers/SecurityManager')
AuthorizationManager = require('./Features/Security/AuthorizationManager')
versioningController =  require("./Features/Versioning/VersioningApiController")
EditorController = require("./Features/Editor/EditorController")
EditorUpdatesController = require("./Features/Editor/EditorUpdatesController")
Settings = require('settings-sharelatex')
TpdsController = require('./Features/ThirdPartyDataStore/TpdsController')
ProjectHandler = require('./handlers/ProjectHandler')
dropboxHandler = require('./Features/Dropbox/DropboxHandler')
SubscriptionRouter = require './Features/Subscription/SubscriptionRouter'
UploadsRouter = require './Features/Uploads/UploadsRouter'
metrics = require('./infrastructure/Metrics')
ReferalController = require('./Features/Referal/ReferalController')
ReferalMiddleware = require('./Features/Referal/ReferalMiddleware')
TemplatesController = require('./Features/Templates/TemplatesController')
TemplatesMiddlewear = require('./Features/Templates/TemplatesMiddlewear')
AuthenticationController = require('./Features/Authentication/AuthenticationController')
TagsController = require("./Features/Tags/TagsController")
CollaboratorsController = require('./Features/Collaborators/CollaboratorsController')
PersonalInfoController = require('./Features/User/UserController')
DocumentController = require('./Features/Documents/DocumentController')
CompileManager = require("./Features/Compile/CompileManager")
CompileController = require("./Features/Compile/CompileController")
HealthCheckController = require("./Features/HealthCheck/HealthCheckController")
ProjectDownloadsController = require "./Features/Downloads/ProjectDownloadsController"
FileStoreController = require("./Features/FileStore/FileStoreController")
logger = require("logger-sharelatex")

httpAuth = require('express').basicAuth (user, pass)->
	isValid = Settings.httpAuthUsers[user] == pass
	if !isValid
		logger.err user:user, pass:pass, "invalid login details"
	return isValid

module.exports = class Router
	constructor: (app, io, socketSessions)->
		app.use(app.router)

		collaberationManager = new CollaberationManager(io)

		Project = new ProjectController(collaberationManager)
		projectHandler = new ProjectHandler()

		app.get  '/', HomeController.index
		
		app.get  '/login', UserController.loginForm
		app.post '/login', AuthenticationController.login
		app.get  '/logout', UserController.logout
		app.get  '/restricted', SecutiryManager.restricted

		app.get '/resources', HomeController.resources
		app.get '/comments', HomeController.comments
		app.get '/tos', HomeController.tos
		app.get '/about', HomeController.about
		app.get '/attribution', HomeController.attribution
		app.get '/security', HomeController.security
		app.get '/privacy_policy', HomeController.privacy
		app.get '/planned_maintenance', HomeController.planned_maintenance
		app.get '/themes', InfoController.themes
		app.get '/advisor', InfoController.advisor
		app.get '/dropbox', InfoController.dropbox

		app.get  '/register', UserController.registerForm
		app.post '/register', UserController.apiRegister

		SubscriptionRouter.apply(app)
		UploadsRouter.apply(app)

		if Settings.enableSubscriptions
			app.get  '/user/bonus', AuthenticationController.requireLogin(), ReferalMiddleware.getUserReferalId, ReferalController.bonus

		app.get  '/user/settings', AuthenticationController.requireLogin(), UserController.settings
		app.post '/user/settings', AuthenticationController.requireLogin(), UserController.apiUpdate
		app.post '/user/password/update', AuthenticationController.requireLogin(), UserController.changePassword
		app.get  '/user/passwordreset', UserController.requestPasswordReset
		app.post '/user/passwordReset', UserController.doRequestPasswordReset
		app.del  '/user/newsletter/unsubscribe', AuthenticationController.requireLogin(), UserController.unsubscribe
		app.del  '/user', AuthenticationController.requireLogin(), UserController.deleteUser

		app.get  '/dropbox/beginAuth', UserController.redirectUserToDropboxAuth
		app.get  '/dropbox/completeRegistration', UserController.completeDropboxRegistration
		app.get  '/dropbox/unlink', UserController.unlinkDropbox

		app.get  '/user/auth_token', AuthenticationController.requireLogin(), AuthenticationController.getAuthToken
		app.get  '/user/personal_info', AuthenticationController.requireLogin(allow_auth_token: true), PersonalInfoController.getLoggedInUsersPersonalInfo
		app.get  '/user/:user_id/personal_info', httpAuth, PersonalInfoController.getPersonalInfo
		
		app.get  '/project', AuthenticationController.requireLogin(), Project.list
		app.post '/project/new', AuthenticationController.requireLogin(), Project.apiNewProject
		app.get '/project/new/template', TemplatesMiddlewear.saveTemplateDataInSession, AuthenticationController.requireLogin(), TemplatesController.createProjectFromZipTemplate

		app.get  '/Project/:Project_id', SecutiryManager.requestCanAccessProject, Project.loadEditor
		app.get  '/Project/:Project_id/file/:File_id', SecutiryManager.requestCanAccessProject, FileStoreController.getFile

		# This is left for legacy reasons and can be removed once all editors have had a chance to refresh:
		app.get  '/Project/:Project_id/download/pdf', SecutiryManager.requestCanAccessProject, CompileController.downloadPdf

		app.get  '/Project/:Project_id/output/output.pdf', SecutiryManager.requestCanAccessProject, CompileController.downloadPdf
		app.get  /^\/project\/([^\/]*)\/output\/(.*)$/,
			((req, res, next) ->
				params =
					"Project_id": req.params[0]
					"file":       req.params[1]
				req.params = params
				next()
			), SecutiryManager.requestCanAccessProject, CompileController.getFileFromClsi

		app.del  '/Project/:Project_id',  SecutiryManager.requestIsOwner, Project.deleteProject
		app.post  '/Project/:Project_id/clone', SecutiryManager.requestCanAccessProject, Project.cloneProject

		app.post '/Project/:Project_id/snapshot', SecutiryManager.requestCanModifyProject, versioningController.takeSnapshot
		app.get  '/Project/:Project_id/version', SecutiryManager.requestCanAccessProject, versioningController.listVersions
		app.get  '/Project/:Project_id/version/:Version_id', SecutiryManager.requestCanAccessProject, versioningController.getVersion
		app.get  '/Project/:Project_id/version', SecutiryManager.requestCanAccessProject, versioningController.listVersions
		app.get  '/Project/:Project_id/version/:Version_id', SecutiryManager.requestCanAccessProject, versioningController.getVersion

		app.post '/project/:project_id/leave', AuthenticationController.requireLogin(), CollaboratorsController.removeSelfFromProject
		app.get  '/project/:Project_id/collaborators', SecutiryManager.requestCanAccessProject(allow_auth_token: true), CollaboratorsController.getCollaborators

		app.get  '/Project/:Project_id/download/zip', SecutiryManager.requestCanAccessProject, ProjectDownloadsController.downloadProject


		app.get '/tag', AuthenticationController.requireLogin(), TagsController.getAllTags
		app.post '/project/:project_id/tag', AuthenticationController.requireLogin(), TagsController.processTagsUpdate

		app.get  '/project/:project_id/details', httpAuth, ProjectApiController.getProjectDetails

		app.get '/internal/project/:Project_id/zip', httpAuth, ProjectDownloadsController.downloadProject
		app.get '/internal/project/:project_id/compile/pdf', httpAuth, CompileController.compileAndDownloadPdf


		app.get  '/project/:Project_id/doc/:doc_id', httpAuth, DocumentController.getDocument
		app.post '/project/:Project_id/doc/:doc_id', httpAuth, DocumentController.setDocument
		app.ignoreCsrf('post', '/project/:Project_id/doc/:doc_id')

		app.post '/user/:user_id/update/*', httpAuth, Project.startBufferingRequest, TpdsController.mergeUpdate
		app.del  '/user/:user_id/update/*', httpAuth, TpdsController.deleteUpdate
		app.ignoreCsrf('post', '/user/:user_id/update/*')
		app.ignoreCsrf('delete', '/user/:user_id/update/*')

		app.get	 '/enableversioning/:Project_id', (req, res)->
			versioningController.enableVersioning req.params.Project_id, -> res.send()

		app.get  /^\/project\/([^\/]*)\/version\/([^\/]*)\/file\/(.*)$/,
			((req, res, next) ->
				params =
					"Project_id": req.params[0]
					"Version_id": req.params[1]
					"File_id":    req.params[2]
				req.params = params
				next()
			),
			SecutiryManager.requestCanAccessProject, versioningController.getVersionFile

		app.post "/spelling/check", AuthenticationController.requireLogin(), SpellingController.proxyRequestToSpellingApi
		app.post "/spelling/learn", AuthenticationController.requireLogin(), SpellingController.proxyRequestToSpellingApi

		#Admin Stuff
		app.get  '/admin', SecutiryManager.requestIsAdmin, AdminController.index
		app.post '/admin/closeEditor', SecutiryManager.requestIsAdmin, AdminController.closeEditor
		app.post '/admin/dissconectAllUsers', SecutiryManager.requestIsAdmin, AdminController.dissconectAllUsers
		app.post '/admin/writeAllDocsToMongo', SecutiryManager.requestIsAdmin, AdminController.writeAllToMongo
		app.post '/admin/addquote', SecutiryManager.requestIsAdmin, AdminController.addQuote
		app.post '/admin/syncUserToSubscription', SecutiryManager.requestIsAdmin, AdminController.syncUserToSubscription
		app.post '/admin/flushProjectToTpds', SecutiryManager.requestIsAdmin, AdminController.flushProjectToTpds
		app.post '/admin/pollUsersWithDropbox', SecutiryManager.requestIsAdmin, AdminController.pollUsersWithDropbox
		app.post '/admin/updateProjectCompiler', SecutiryManager.requestIsAdmin, AdminController.updateProjectCompiler

		app.get '/perfTest', (req,res)->
			res.send("hello")
			req.session.destroy()

		app.get '/status', (req,res)->
			res.send("websharelatex is up")
			req.session.destroy()

		app.get '/health_check', HealthCheckController.check

		app.get "/status/compiler/:Project_id", SecutiryManager.requestCanAccessProject, (req, res) ->
			success = false
			CompileManager.compile req.params.Project_id, "test-compile", {}, () ->
				success = true
				res.writeHead 200
				res.end "Compiler returned in less than 10 seconds"
			setTimeout (() ->
				if !success
					res.writeHead 500
					res.end "Compiler timed out"
			), 10000
			req.session.destroy()

		app.get '/test', (req, res) ->
			res.render "tests",
				privlageLevel: "owner"
				project:
					name: "test"
				date: Date.now()
				layout: false
				userCanSeeDropbox: true
				languages: []

		app.get '/oops-express', (req, res, next) -> next(new Error("Test error"))
		app.get '/oops-internal', (req, res, next) -> throw new Error("Test error")
		app.get '/oops-mongo', (req, res, next) ->
			require("./models/Project").Project.findOne {}, () ->
				throw new Error("Test error")

		app.get '*', HomeController.notFound


		socketSessions.on 'connection', (err, client, session)->
			metrics.inc('socket-io.connection')
			# This is not ideal - we should come up with a better way of handling
			# anonymous users, but various logging lines rely on user._id
			if !session or !session.user?
				user = {_id: "anonymous-user"}
			else
				user = session.user

			client.on 'joinProject', (data, callback) ->
				EditorController.joinProject(client, user, data.project_id, callback)

			client.on 'disconnect', () ->
				metrics.inc ('socket-io.disconnect')
				EditorController.leaveProject client, user

			client.on 'reportError', (error, callback) ->
				EditorController.reportError client, error, callback

			client.on 'sendUpdate', (doc_id, windowName, change)->
				AuthorizationManager.ensureClientCanEditProject client, (error, project_id) =>
					EditorUpdatesController.applyAceUpdate(client, project_id, doc_id, windowName, change)

			client.on 'applyOtUpdate', (doc_id, update) ->
				AuthorizationManager.ensureClientCanEditProject client, (error, project_id) =>
					EditorUpdatesController.applyOtUpdate(client, project_id, doc_id, update)

			client.on 'clientTracking.updatePosition', (cursorData) ->
				AuthorizationManager.ensureClientCanViewProject client, (error, project_id) =>
					EditorController.updateClientPosition(client, cursorData)

			client.on 'addUserToProject', (email, newPrivalageLevel, callback)->
				AuthorizationManager.ensureClientCanAdminProject client, (error, project_id) =>
					EditorController.addUserToProject project_id, email, newPrivalageLevel, callback

			client.on 'removeUserFromProject', (user_id, callback)->
				AuthorizationManager.ensureClientCanAdminProject client, (error, project_id) =>
					EditorController.removeUserFromProject(project_id, user_id, callback)

			client.on 'setSpellCheckLanguage', (compiler, callback)->
				AuthorizationManager.ensureClientCanEditProject client, (error, project_id) =>
					EditorController.setSpellCheckLanguage project_id, compiler, callback

			client.on 'setCompiler', (compiler, callback)->
				AuthorizationManager.ensureClientCanEditProject client, (error, project_id) =>
					EditorController.setCompiler project_id, compiler, callback

			client.on 'leaveDoc', (doc_id, callback)->
				AuthorizationManager.ensureClientCanViewProject client, (error, project_id) =>
					EditorController.leaveDoc(client, project_id, doc_id, callback)

			client.on 'joinDoc', (args...)->
				AuthorizationManager.ensureClientCanViewProject client, (error, project_id) =>
					EditorController.joinDoc(client, project_id, args...)

			client.on 'addDoc', (folder_id, docName, callback)->
			 	AuthorizationManager.ensureClientCanEditProject client, (error, project_id) =>
				 	EditorController.addDoc(project_id, folder_id, docName, [""], callback)

			client.on 'addFolder', (folder_id, folderName, callback)->
			 	AuthorizationManager.ensureClientCanEditProject client, (error, project_id) =>
				 	EditorController.addFolder(project_id, folder_id, folderName, callback)

			client.on 'deleteEntity', (entity_id, entityType, callback)->
				AuthorizationManager.ensureClientCanEditProject client, (error, project_id) =>
					EditorController.deleteEntity(project_id, entity_id, entityType, callback)

			client.on 'renameEntity', (entity_id, entityType, newName, callback)->
				AuthorizationManager.ensureClientCanEditProject client, (error, project_id) =>
					collaberationManager.renameEntity(project_id, entity_id, entityType, newName, callback)

			client.on 'moveEntity', (entity_id, folder_id, entityType, callback)->
				AuthorizationManager.ensureClientCanEditProject client, (error, project_id) =>
					collaberationManager.moveEntity(project_id, entity_id, folder_id, entityType, callback)

			client.on 'setProjectName', (window_id, newName, callback)->
				AuthorizationManager.ensureClientCanEditProject client, (error, project_id) =>
					collaberationManager.renameProject(project_id, window_id, newName, callback)

			client.on 'getProject',(callback)->
			 	AuthorizationManager.ensureClientCanViewProject client, (error, project_id) =>
			 		projectHandler.getProject(project_id, callback)

			client.on 'setRootDoc', (newRootDocID, callback)->
				AuthorizationManager.ensureClientCanEditProject client, (error, project_id) =>
					collaberationManager.setRootDoc(project_id, newRootDocID, callback)

			client.on 'deleteProject', (callback)->
				AuthorizationManager.ensureClientCanAdminProject client, (error, project_id) =>
					collaberationManager.deleteProject(project_id, callback)

			client.on 'setPublicAccessLevel', (newAccessLevel, callback)->
				AuthorizationManager.ensureClientCanAdminProject client, (error, project_id) =>
					collaberationManager.setPublicAccessLevel(project_id, newAccessLevel, callback)

			client.on 'pdfProject', (opts, callback)->
				AuthorizationManager.ensureClientCanViewProject client, (error, project_id) =>
					CompileManager.compile(project_id, user._id, opts, callback)

			# This is deprecated and can be removed once all editors have had a chance to refresh
			client.on 'getRawLogs', (callback)->
				AuthorizationManager.ensureClientCanViewProject client, (error, project_id) =>
					CompileManager.getLogLines project_id, callback

			client.on 'distributMessage', (message)->
				AuthorizationManager.ensureClientCanViewProject client, (error, project_id) =>
					collaberationManager.distributMessage project_id, client, message

			client.on 'changeUsersPrivlageLevel', (user_id, newPrivalageLevel)->
				AuthorizationManager.ensureClientCanAdminProject client, (error, project_id) =>
					projectHandler.changeUsersPrivlageLevel project_id, user_id, newPrivalageLevel

			client.on 'enableversioningController', (callback)->
				AuthorizationManager.ensureClientCanEditProject client, (error, project_id) =>
					versioningController.enableVersioning project_id, callback

			client.on 'getRootDocumentsList', (callback)->
				AuthorizationManager.ensureClientCanEditProject client, (error, project_id) =>
					EditorController.getListOfDocPaths project_id, callback

			client.on 'forceResyncOfDropbox', (callback)->
				AuthorizationManager.ensureClientCanAdminProject client, (error, project_id) =>
					EditorController.forceResyncOfDropbox project_id, callback

			client.on 'getUserDropboxLinkStatus', (owner_id, callback)->
				AuthorizationManager.ensureClientCanAdminProject client, (error, project_id) =>
					dropboxHandler.getUserRegistrationStatus owner_id, callback

			client.on 'publishProjectAsTemplate', (user_id, callback)->
				AuthorizationManager.ensureClientCanAdminProject client, (error, project_id) =>
					TemplatesController.publishProject user_id, project_id, callback

			client.on 'unPublishProjectAsTemplate', (user_id, callback)->
				AuthorizationManager.ensureClientCanAdminProject client, (error, project_id) =>
					TemplatesController.unPublishProject user_id, project_id, callback

			client.on 'updateProjectDescription', (description, callback)->
				AuthorizationManager.ensureClientCanEditProject client, (error, project_id) =>
					EditorController.updateProjectDescription project_id, description, callback

			client.on "getLastTimePollHappned", (callback)->
				EditorController.getLastTimePollHappned(callback)

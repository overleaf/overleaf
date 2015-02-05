AdminController = require('./Features/ServerAdmin/AdminController')
ErrorController = require('./Features/Errors/ErrorController')
ProjectController = require("./Features/Project/ProjectController")
ProjectApiController = require("./Features/Project/ProjectApiController")
SpellingController = require('./Features/Spelling/SpellingController')
SecurityManager = require('./managers/SecurityManager')
AuthorizationManager = require('./Features/Security/AuthorizationManager')
EditorController = require("./Features/Editor/EditorController")
EditorRouter = require("./Features/Editor/EditorRouter")
Settings = require('settings-sharelatex')
TpdsController = require('./Features/ThirdPartyDataStore/TpdsController')
SubscriptionRouter = require './Features/Subscription/SubscriptionRouter'
UploadsRouter = require './Features/Uploads/UploadsRouter'
metrics = require('./infrastructure/Metrics')
ReferalController = require('./Features/Referal/ReferalController')
ReferalMiddleware = require('./Features/Referal/ReferalMiddleware')
TemplatesRouter = require('./Features/Templates/TemplatesRouter')
AuthenticationController = require('./Features/Authentication/AuthenticationController')
TagsController = require("./Features/Tags/TagsController")
CollaboratorsRouter = require('./Features/Collaborators/CollaboratorsRouter')
UserInfoController = require('./Features/User/UserInfoController')
UserController = require("./Features/User/UserController")
UserPagesController = require('./Features/User/UserPagesController')
DocumentController = require('./Features/Documents/DocumentController')
CompileManager = require("./Features/Compile/CompileManager")
CompileController = require("./Features/Compile/CompileController")
HealthCheckController = require("./Features/HealthCheck/HealthCheckController")
ProjectDownloadsController = require "./Features/Downloads/ProjectDownloadsController"
FileStoreController = require("./Features/FileStore/FileStoreController")
TrackChangesController = require("./Features/TrackChanges/TrackChangesController")
PasswordResetRouter = require("./Features/PasswordReset/PasswordResetRouter")
StaticPagesRouter = require("./Features/StaticPages/StaticPagesRouter")
ChatController = require("./Features/Chat/ChatController")
BlogController = require("./Features/Blog/BlogController")
WikiController = require("./Features/Wiki/WikiController")
Modules = require "./infrastructure/Modules"
RateLimiterMiddlewear = require('./Features/Security/RateLimiterMiddlewear')

logger = require("logger-sharelatex")
_ = require("underscore")

httpAuth = require('express').basicAuth (user, pass)->
	isValid = Settings.httpAuthUsers[user] == pass
	if !isValid
		logger.err user:user, pass:pass, "invalid login details"
	return isValid

module.exports = class Router
	constructor: (app)->
		app.use(app.router)
		
		app.get  '/login', UserPagesController.loginPage
		app.post '/login', AuthenticationController.login
		app.get  '/logout', UserController.logout
		app.get  '/restricted', SecurityManager.restricted

		app.get  '/register', UserPagesController.registerPage
		app.post '/register', UserController.register

		EditorRouter.apply(app, httpAuth)
		CollaboratorsRouter.apply(app)
		SubscriptionRouter.apply(app)
		UploadsRouter.apply(app)
		PasswordResetRouter.apply(app)
		StaticPagesRouter.apply(app)
		TemplatesRouter.apply(app)
		
		Modules.applyRouter(app)

		app.get '/blog', BlogController.getIndexPage
		app.get '/blog/*', BlogController.getPage

		if Settings.enableSubscriptions
			app.get  '/user/bonus', AuthenticationController.requireLogin(), ReferalMiddleware.getUserReferalId, ReferalController.bonus

		app.get  '/user/settings', AuthenticationController.requireLogin(), UserPagesController.settingsPage
		app.post '/user/settings', AuthenticationController.requireLogin(), UserController.updateUserSettings
		app.post '/user/password/update', AuthenticationController.requireLogin(), UserController.changePassword

		app.del  '/user/newsletter/unsubscribe', AuthenticationController.requireLogin(), UserController.unsubscribe
		app.del  '/user', AuthenticationController.requireLogin(), UserController.deleteUser

		app.get  '/user/auth_token', AuthenticationController.requireLogin(), AuthenticationController.getAuthToken
		app.get  '/user/personal_info', AuthenticationController.requireLogin(allow_auth_token: true), UserInfoController.getLoggedInUsersPersonalInfo
		app.get  '/user/:user_id/personal_info', httpAuth, UserInfoController.getPersonalInfo

		app.get  '/project', AuthenticationController.requireLogin(), ProjectController.projectListPage
		app.post '/project/new', AuthenticationController.requireLogin(), ProjectController.newProject

		app.get  '/Project/:Project_id', RateLimiterMiddlewear.rateLimit({
			endpointName: "open-project"
			params: ["Project_id"]
			maxRequests: 10
			timeInterval: 60
		}), SecurityManager.requestCanAccessProject, ProjectController.loadEditor
		app.get  '/Project/:Project_id/file/:File_id', SecurityManager.requestCanAccessProject, FileStoreController.getFile

		app.post '/project/:Project_id/settings', SecurityManager.requestCanModifyProject, ProjectController.updateProjectSettings

		app.post '/project/:Project_id/compile', SecurityManager.requestCanAccessProject, CompileController.compile
		app.get  '/Project/:Project_id/output/output.pdf', SecurityManager.requestCanAccessProject, CompileController.downloadPdf
		app.get  /^\/project\/([^\/]*)\/output\/(.*)$/,
			((req, res, next) ->
				params =
					"Project_id": req.params[0]
					"file":       req.params[1]
				req.params = params
				next()
			), SecurityManager.requestCanAccessProject, CompileController.getFileFromClsi
		app.del "/project/:Project_id/output", SecurityManager.requestCanAccessProject, CompileController.deleteAuxFiles
		app.get "/project/:Project_id/sync/code", SecurityManager.requestCanAccessProject, CompileController.proxySync
		app.get "/project/:Project_id/sync/pdf", SecurityManager.requestCanAccessProject, CompileController.proxySync

		app.del  '/Project/:Project_id', SecurityManager.requestIsOwner, ProjectController.deleteProject
		app.post '/Project/:Project_id/restore', SecurityManager.requestIsOwner, ProjectController.restoreProject
		app.post '/Project/:Project_id/clone', SecurityManager.requestCanAccessProject, ProjectController.cloneProject

		app.post '/project/:Project_id/rename', SecurityManager.requestIsOwner, ProjectController.renameProject

		app.get  "/project/:Project_id/updates", SecurityManager.requestCanAccessProject, TrackChangesController.proxyToTrackChangesApi
		app.get  "/project/:Project_id/doc/:doc_id/diff", SecurityManager.requestCanAccessProject, TrackChangesController.proxyToTrackChangesApi
		app.post "/project/:Project_id/doc/:doc_id/version/:version_id/restore", SecurityManager.requestCanAccessProject, TrackChangesController.proxyToTrackChangesApi

		app.get  '/Project/:Project_id/download/zip', SecurityManager.requestCanAccessProject, ProjectDownloadsController.downloadProject
		app.get  '/project/download/zip', SecurityManager.requestCanAccessMultipleProjects, ProjectDownloadsController.downloadMultipleProjects

		app.get '/tag', AuthenticationController.requireLogin(), TagsController.getAllTags
		app.post '/project/:project_id/tag', AuthenticationController.requireLogin(), TagsController.processTagsUpdate

		app.get  '/project/:project_id/details', httpAuth, ProjectApiController.getProjectDetails

		app.get '/internal/project/:Project_id/zip', httpAuth, ProjectDownloadsController.downloadProject
		app.get '/internal/project/:project_id/compile/pdf', httpAuth, CompileController.compileAndDownloadPdf


		app.get  '/project/:Project_id/doc/:doc_id', httpAuth, DocumentController.getDocument
		app.post '/project/:Project_id/doc/:doc_id', httpAuth, DocumentController.setDocument
		app.ignoreCsrf('post', '/project/:Project_id/doc/:doc_id')

		app.post '/user/:user_id/update/*', httpAuth, TpdsController.mergeUpdate
		app.del  '/user/:user_id/update/*', httpAuth, TpdsController.deleteUpdate
		app.ignoreCsrf('post', '/user/:user_id/update/*')
		app.ignoreCsrf('delete', '/user/:user_id/update/*')
		
		app.post '/project/:project_id/contents/*', httpAuth, TpdsController.updateProjectContents
		app.del  '/project/:project_id/contents/*', httpAuth, TpdsController.deleteProjectContents
		app.ignoreCsrf('post', '/project/:project_id/contents/*')
		app.ignoreCsrf('delete', '/project/:project_id/contents/*')

		app.post "/spelling/check", AuthenticationController.requireLogin(), SpellingController.proxyRequestToSpellingApi
		app.post "/spelling/learn", AuthenticationController.requireLogin(), SpellingController.proxyRequestToSpellingApi

		app.get  "/project/:Project_id/messages", SecurityManager.requestCanAccessProject, ChatController.getMessages
		app.post "/project/:Project_id/messages", SecurityManager.requestCanAccessProject, ChatController.sendMessage
		
		app.get  /learn(\/.*)?/, WikiController.getPage

		#Admin Stuff
		app.get  '/admin', SecurityManager.requestIsAdmin, AdminController.index
		app.post '/admin/closeEditor', SecurityManager.requestIsAdmin, AdminController.closeEditor
		app.post '/admin/dissconectAllUsers', SecurityManager.requestIsAdmin, AdminController.dissconectAllUsers
		app.post '/admin/syncUserToSubscription', SecurityManager.requestIsAdmin, AdminController.syncUserToSubscription
		app.post '/admin/flushProjectToTpds', SecurityManager.requestIsAdmin, AdminController.flushProjectToTpds
		app.post '/admin/pollDropboxForUser', SecurityManager.requestIsAdmin, AdminController.pollDropboxForUser
		app.post '/admin/messages', SecurityManager.requestIsAdmin, AdminController.createMessage
		app.post '/admin/messages/clear', SecurityManager.requestIsAdmin, AdminController.clearMessages

		app.get '/perfTest', (req,res)->
			res.send("hello")
			req.session.destroy()

		app.get '/status', (req,res)->
			res.send("websharelatex is up")
			req.session.destroy()

		app.get '/health_check', HealthCheckController.check
		app.get '/health_check/redis', HealthCheckController.checkRedis

		app.get "/status/compiler/:Project_id", SecurityManager.requestCanAccessProject, (req, res) ->
			sendRes = _.once (statusCode, message)->
				res.writeHead statusCode
				res.end message
			CompileManager.compile req.params.Project_id, "test-compile", {}, () ->
				sendRes 200, "Compiler returned in less than 10 seconds"
			setTimeout (() ->
				sendRes 500, "Compiler timed out"
			), 10000
			req.session.destroy()

		app.get "/ip", (req, res, next) ->
			res.send({
				ip: req.ip
				ips: req.ips
				headers: req.headers
			})

		app.get '/oops-express', (req, res, next) -> next(new Error("Test error"))
		app.get '/oops-internal', (req, res, next) -> throw new Error("Test error")
		app.get '/oops-mongo', (req, res, next) ->
			require("./models/Project").Project.findOne {}, () ->
				throw new Error("Test error")

		app.get '/opps-small', (req, res, next)->
			logger.err "test error occured"
			res.send()

		app.post '/error/client', (req, res, next) ->
			logger.error err: req.body.error, meta: req.body.meta, "client side error"
			res.send(204)

		app.get '*', ErrorController.notFound

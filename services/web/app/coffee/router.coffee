AdminController = require('./Features/ServerAdmin/AdminController')
ErrorController = require('./Features/Errors/ErrorController')
ProjectController = require("./Features/Project/ProjectController")
ProjectApiController = require("./Features/Project/ProjectApiController")
SpellingController = require('./Features/Spelling/SpellingController')
EditorController = require("./Features/Editor/EditorController")
EditorRouter = require("./Features/Editor/EditorRouter")
Settings = require('settings-sharelatex')
TpdsController = require('./Features/ThirdPartyDataStore/TpdsController')
SubscriptionRouter = require './Features/Subscription/SubscriptionRouter'
UploadsRouter = require './Features/Uploads/UploadsRouter'
metrics = require('./infrastructure/Metrics')
ReferalController = require('./Features/Referal/ReferalController')
AuthenticationController = require('./Features/Authentication/AuthenticationController')
TagsController = require("./Features/Tags/TagsController")
NotificationsController = require("./Features/Notifications/NotificationsController")
CollaboratorsRouter = require('./Features/Collaborators/CollaboratorsRouter')
UserInfoController = require('./Features/User/UserInfoController')
UserController = require("./Features/User/UserController")
UserPagesController = require('./Features/User/UserPagesController')
DocumentController = require('./Features/Documents/DocumentController')
CompileManager = require("./Features/Compile/CompileManager")
CompileController = require("./Features/Compile/CompileController")
ClsiCookieManager = require("./Features/Compile/ClsiCookieManager")
HealthCheckController = require("./Features/HealthCheck/HealthCheckController")
ProjectDownloadsController = require "./Features/Downloads/ProjectDownloadsController"
FileStoreController = require("./Features/FileStore/FileStoreController")
HistoryController = require("./Features/History/HistoryController")
PasswordResetRouter = require("./Features/PasswordReset/PasswordResetRouter")
StaticPagesRouter = require("./Features/StaticPages/StaticPagesRouter")
ChatController = require("./Features/Chat/ChatController")
BlogController = require("./Features/Blog/BlogController")
Modules = require "./infrastructure/Modules"
RateLimiterMiddlewear = require('./Features/Security/RateLimiterMiddlewear')
RealTimeProxyRouter = require('./Features/RealTimeProxy/RealTimeProxyRouter')
InactiveProjectController = require("./Features/InactiveData/InactiveProjectController")
ContactRouter = require("./Features/Contacts/ContactRouter")
ReferencesController = require('./Features/References/ReferencesController')
AuthorizationMiddlewear = require('./Features/Authorization/AuthorizationMiddlewear')
BetaProgramController = require('./Features/BetaProgram/BetaProgramController')
AnalyticsRouter = require('./Features/Analytics/AnalyticsRouter')
AnnouncementsController = require("./Features/Announcements/AnnouncementsController")
RangesController = require("./Features/Ranges/RangesController")

logger = require("logger-sharelatex")
_ = require("underscore")

module.exports = class Router
	constructor: (webRouter, apiRouter)->
		if !Settings.allowPublicAccess
			webRouter.all '*', AuthenticationController.requireGlobalLogin


		webRouter.get  '/login', UserPagesController.loginPage
		AuthenticationController.addEndpointToLoginWhitelist '/login'

		webRouter.post '/login', AuthenticationController.passportLogin

		webRouter.get  '/logout', UserController.logout
		webRouter.get  '/restricted', AuthorizationMiddlewear.restricted

		# Left as a placeholder for implementing a public register page
		webRouter.get  '/register', UserPagesController.registerPage
		AuthenticationController.addEndpointToLoginWhitelist '/register'


		EditorRouter.apply(webRouter, apiRouter)
		CollaboratorsRouter.apply(webRouter, apiRouter)
		SubscriptionRouter.apply(webRouter, apiRouter)
		UploadsRouter.apply(webRouter, apiRouter)
		PasswordResetRouter.apply(webRouter, apiRouter)
		StaticPagesRouter.apply(webRouter, apiRouter)
		RealTimeProxyRouter.apply(webRouter, apiRouter)
		ContactRouter.apply(webRouter, apiRouter)
		AnalyticsRouter.apply(webRouter, apiRouter)

		Modules.applyRouter(webRouter, apiRouter)


		if Settings.enableSubscriptions
			webRouter.get  '/user/bonus', AuthenticationController.requireLogin(), ReferalController.bonus

		webRouter.get '/blog', BlogController.getIndexPage
		webRouter.get '/blog/*', BlogController.getPage

		webRouter.get '/user/activate', UserPagesController.activateAccountPage
		AuthenticationController.addEndpointToLoginWhitelist '/user/activate'

		webRouter.get  '/user/settings', AuthenticationController.requireLogin(), UserPagesController.settingsPage
		webRouter.post '/user/settings', AuthenticationController.requireLogin(), UserController.updateUserSettings
		webRouter.post '/user/password/update', AuthenticationController.requireLogin(), UserController.changePassword

		webRouter.get  '/user/sessions', AuthenticationController.requireLogin(), UserPagesController.sessionsPage
		webRouter.post '/user/sessions/clear', AuthenticationController.requireLogin(), UserController.clearSessions

		webRouter.delete '/user/newsletter/unsubscribe', AuthenticationController.requireLogin(), UserController.unsubscribe
		webRouter.post '/user/delete', AuthenticationController.requireLogin(), UserController.tryDeleteUser

		webRouter.get  '/user/personal_info', AuthenticationController.requireLogin(), UserInfoController.getLoggedInUsersPersonalInfo
		apiRouter.get  '/user/:user_id/personal_info', AuthenticationController.httpAuth, UserInfoController.getPersonalInfo

		webRouter.get  '/project', AuthenticationController.requireLogin(), ProjectController.projectListPage
		webRouter.post '/project/new', AuthenticationController.requireLogin(), ProjectController.newProject

		webRouter.get  '/Project/:Project_id', RateLimiterMiddlewear.rateLimit({
			endpointName: "open-project"
			params: ["Project_id"]
			maxRequests: 10
			timeInterval: 60
		}), AuthorizationMiddlewear.ensureUserCanReadProject, ProjectController.loadEditor
		webRouter.get  '/Project/:Project_id/file/:File_id', AuthorizationMiddlewear.ensureUserCanReadProject, FileStoreController.getFile
		webRouter.post '/project/:Project_id/settings', AuthorizationMiddlewear.ensureUserCanWriteProjectSettings, ProjectController.updateProjectSettings
		webRouter.post '/project/:Project_id/settings/admin', AuthorizationMiddlewear.ensureUserCanAdminProject, ProjectController.updateProjectAdminSettings

		webRouter.post '/project/:Project_id/compile', AuthorizationMiddlewear.ensureUserCanReadProject, CompileController.compile
		webRouter.post '/project/:Project_id/compile/stop', AuthorizationMiddlewear.ensureUserCanReadProject, CompileController.stopCompile

		# Used by the web download buttons, adds filename header
		webRouter.get  '/project/:Project_id/output/output.pdf', AuthorizationMiddlewear.ensureUserCanReadProject, CompileController.downloadPdf
		# Used by the pdf viewers
		webRouter.get  /^\/project\/([^\/]*)\/output\/(.*)$/,
			((req, res, next) ->
				params =
					"Project_id": req.params[0]
					"file":       req.params[1]
				req.params = params
				next()
			), AuthorizationMiddlewear.ensureUserCanReadProject, CompileController.getFileFromClsi
		# direct url access to output files for a specific build (query string not required)
		webRouter.get  /^\/project\/([^\/]*)\/build\/([0-9a-f-]+)\/output\/(.*)$/,
			((req, res, next) ->
				params =
					"Project_id": req.params[0]
					"build_id":   req.params[1]
					"file":       req.params[2]
				req.params = params
				next()
			), AuthorizationMiddlewear.ensureUserCanReadProject, CompileController.getFileFromClsi

		# direct url access to output files for user but no build, to retrieve files when build fails
		webRouter.get  /^\/project\/([^\/]*)\/user\/([0-9a-f-]+)\/output\/(.*)$/,
			((req, res, next) ->
				params =
					"Project_id": req.params[0]
					"user_id":   req.params[1]
					"file":       req.params[2]
				req.params = params
				next()
			), AuthorizationMiddlewear.ensureUserCanReadProject, CompileController.getFileFromClsi

		# direct url access to output files for a specific user and build (query string not required)
		webRouter.get  /^\/project\/([^\/]*)\/user\/([0-9a-f]+)\/build\/([0-9a-f-]+)\/output\/(.*)$/,
			((req, res, next) ->
				params =
					"Project_id": req.params[0]
					"user_id":    req.params[1]
					"build_id":   req.params[2]
					"file":       req.params[3]
				req.params = params
				next()
			), AuthorizationMiddlewear.ensureUserCanReadProject, CompileController.getFileFromClsi


		webRouter.delete "/project/:Project_id/output", AuthorizationMiddlewear.ensureUserCanReadProject, CompileController.deleteAuxFiles
		webRouter.get "/project/:Project_id/sync/code", AuthorizationMiddlewear.ensureUserCanReadProject, CompileController.proxySyncCode
		webRouter.get "/project/:Project_id/sync/pdf", AuthorizationMiddlewear.ensureUserCanReadProject, CompileController.proxySyncPdf
		webRouter.get "/project/:Project_id/wordcount", AuthorizationMiddlewear.ensureUserCanReadProject, CompileController.wordCount

		webRouter.delete '/Project/:Project_id', AuthorizationMiddlewear.ensureUserCanAdminProject, ProjectController.deleteProject
		webRouter.post '/Project/:Project_id/restore', AuthorizationMiddlewear.ensureUserCanAdminProject, ProjectController.restoreProject
		webRouter.post '/Project/:Project_id/clone', AuthorizationMiddlewear.ensureUserCanReadProject, ProjectController.cloneProject

		webRouter.post '/project/:Project_id/rename', AuthorizationMiddlewear.ensureUserCanAdminProject, ProjectController.renameProject

		webRouter.get  "/project/:Project_id/updates", AuthorizationMiddlewear.ensureUserCanReadProject, HistoryController.proxyToHistoryApi
		webRouter.get  "/project/:Project_id/doc/:doc_id/diff", AuthorizationMiddlewear.ensureUserCanReadProject, HistoryController.proxyToHistoryApi
		webRouter.post "/project/:Project_id/doc/:doc_id/version/:version_id/restore", AuthorizationMiddlewear.ensureUserCanReadProject, HistoryController.proxyToHistoryApi

		webRouter.get "/project/:project_id/ranges", AuthorizationMiddlewear.ensureUserCanReadProject, RangesController.getAllRanges

		webRouter.get  '/Project/:Project_id/download/zip', AuthorizationMiddlewear.ensureUserCanReadProject, ProjectDownloadsController.downloadProject
		webRouter.get  '/project/download/zip', AuthorizationMiddlewear.ensureUserCanReadMultipleProjects, ProjectDownloadsController.downloadMultipleProjects

		webRouter.get    '/tag', AuthenticationController.requireLogin(), TagsController.getAllTags
		webRouter.post   '/tag', AuthenticationController.requireLogin(), TagsController.createTag
		webRouter.post   '/tag/:tag_id/rename', AuthenticationController.requireLogin(), TagsController.renameTag
		webRouter.delete '/tag/:tag_id', AuthenticationController.requireLogin(), TagsController.deleteTag
		webRouter.post   '/tag/:tag_id/project/:project_id', AuthenticationController.requireLogin(), TagsController.addProjectToTag
		webRouter.delete '/tag/:tag_id/project/:project_id', AuthenticationController.requireLogin(), TagsController.removeProjectFromTag

		webRouter.get '/notifications', AuthenticationController.requireLogin(), NotificationsController.getAllUnreadNotifications
		webRouter.delete '/notifications/:notification_id', AuthenticationController.requireLogin(), NotificationsController.markNotificationAsRead

		webRouter.get '/announcements', AuthenticationController.requireLogin(), AnnouncementsController.getUndreadAnnouncements


		# Deprecated in favour of /internal/project/:project_id but still used by versioning
		apiRouter.get  '/project/:project_id/details', AuthenticationController.httpAuth, ProjectApiController.getProjectDetails

		# New 'stable' /internal API end points
		apiRouter.get  '/internal/project/:project_id',     AuthenticationController.httpAuth, ProjectApiController.getProjectDetails
		apiRouter.get  '/internal/project/:Project_id/zip', AuthenticationController.httpAuth, ProjectDownloadsController.downloadProject
		apiRouter.get  '/internal/project/:project_id/compile/pdf', AuthenticationController.httpAuth, CompileController.compileAndDownloadPdf

		apiRouter.post '/internal/deactivateOldProjects', AuthenticationController.httpAuth, InactiveProjectController.deactivateOldProjects
		apiRouter.post '/internal/project/:project_id/deactivate', AuthenticationController.httpAuth, InactiveProjectController.deactivateProject

		webRouter.get  /^\/internal\/project\/([^\/]*)\/output\/(.*)$/,
			((req, res, next) ->
				params =
					"Project_id": req.params[0]
					"file":       req.params[1]
				req.params = params
				next()
			), AuthenticationController.httpAuth, CompileController.getFileFromClsi

		apiRouter.get  '/project/:Project_id/doc/:doc_id', AuthenticationController.httpAuth, DocumentController.getDocument
		apiRouter.post '/project/:Project_id/doc/:doc_id', AuthenticationController.httpAuth, DocumentController.setDocument

		apiRouter.post '/user/:user_id/update/*', AuthenticationController.httpAuth, TpdsController.mergeUpdate
		apiRouter.delete '/user/:user_id/update/*', AuthenticationController.httpAuth, TpdsController.deleteUpdate

		apiRouter.post '/project/:project_id/contents/*', AuthenticationController.httpAuth, TpdsController.updateProjectContents
		apiRouter.delete '/project/:project_id/contents/*', AuthenticationController.httpAuth, TpdsController.deleteProjectContents

		webRouter.post "/spelling/check", AuthenticationController.requireLogin(), SpellingController.proxyRequestToSpellingApi
		webRouter.post "/spelling/learn", AuthenticationController.requireLogin(), SpellingController.proxyRequestToSpellingApi

		webRouter.get  "/project/:Project_id/messages", AuthorizationMiddlewear.ensureUserCanReadProject, ChatController.getMessages
		webRouter.post "/project/:Project_id/messages", AuthorizationMiddlewear.ensureUserCanReadProject, ChatController.sendMessage

		webRouter.post "/project/:Project_id/references/index", AuthorizationMiddlewear.ensureUserCanReadProject, ReferencesController.index
		webRouter.post "/project/:Project_id/references/indexAll", AuthorizationMiddlewear.ensureUserCanReadProject, ReferencesController.indexAll

		webRouter.get "/beta/participate",  AuthenticationController.requireLogin(), BetaProgramController.optInPage
		webRouter.post "/beta/opt-in", AuthenticationController.requireLogin(), BetaProgramController.optIn
		webRouter.post "/beta/opt-out", AuthenticationController.requireLogin(), BetaProgramController.optOut

		#Admin Stuff
		webRouter.get  '/admin', AuthorizationMiddlewear.ensureUserIsSiteAdmin, AdminController.index
		webRouter.get  '/admin/user', AuthorizationMiddlewear.ensureUserIsSiteAdmin, (req, res)-> res.redirect("/admin/register") #this gets removed by admin-panel addon
		webRouter.get  '/admin/register', AuthorizationMiddlewear.ensureUserIsSiteAdmin, AdminController.registerNewUser
		webRouter.post '/admin/register', AuthorizationMiddlewear.ensureUserIsSiteAdmin, UserController.register
		webRouter.post '/admin/closeEditor', AuthorizationMiddlewear.ensureUserIsSiteAdmin, AdminController.closeEditor
		webRouter.post '/admin/dissconectAllUsers', AuthorizationMiddlewear.ensureUserIsSiteAdmin, AdminController.dissconectAllUsers
		webRouter.post '/admin/syncUserToSubscription', AuthorizationMiddlewear.ensureUserIsSiteAdmin, AdminController.syncUserToSubscription
		webRouter.post '/admin/flushProjectToTpds', AuthorizationMiddlewear.ensureUserIsSiteAdmin, AdminController.flushProjectToTpds
		webRouter.post '/admin/pollDropboxForUser', AuthorizationMiddlewear.ensureUserIsSiteAdmin, AdminController.pollDropboxForUser
		webRouter.post '/admin/messages', AuthorizationMiddlewear.ensureUserIsSiteAdmin, AdminController.createMessage
		webRouter.post '/admin/messages/clear', AuthorizationMiddlewear.ensureUserIsSiteAdmin, AdminController.clearMessages

		apiRouter.get '/perfTest', (req,res)->
			res.send("hello")

		apiRouter.get '/status', (req,res)->
			res.send("websharelatex is up")

		webRouter.get '/dev/csrf', (req, res) ->
			res.send res.locals.csrfToken

		apiRouter.get '/health_check', HealthCheckController.check
		apiRouter.get '/health_check/redis', HealthCheckController.checkRedis

		apiRouter.get "/status/compiler/:Project_id", AuthorizationMiddlewear.ensureUserCanReadProject, (req, res) ->
			project_id = req.params.Project_id
			sendRes = _.once (statusCode, message)->
				res.status statusCode
				res.send message
				ClsiCookieManager.clearServerId project_id # force every compile to a new server
			# set a timeout
			handler = setTimeout (() ->
				sendRes 500, "Compiler timed out"
				handler = null
			), 10000
			# use a valid user id for testing
			test_user_id = "123456789012345678901234"
			# run the compile
			CompileManager.compile project_id, test_user_id, {}, (error, status) ->
				clearTimeout handler if handler?
				if error?
					sendRes 500, "Compiler returned error #{error.message}"
				else if status is "success"
					sendRes 200, "Compiler returned in less than 10 seconds"
				else
					sendRes 500, "Compiler returned failure #{status}"

		apiRouter.get "/ip", (req, res, next) ->
			res.send({
				ip: req.ip
				ips: req.ips
				headers: req.headers
			})

		webRouter.get '/oops-express', (req, res, next) -> next(new Error("Test error"))
		webRouter.get '/oops-internal', (req, res, next) -> throw new Error("Test error")
		webRouter.get '/oops-mongo', (req, res, next) ->
			require("./models/Project").Project.findOne {}, () ->
				throw new Error("Test error")

		apiRouter.get '/opps-small', (req, res, next)->
			logger.err "test error occured"
			res.send()

		webRouter.post '/error/client', (req, res, next) ->
			logger.warn err: req.body.error, meta: req.body.meta, "client side error"
			metrics.inc("client-side-error")
			res.sendStatus(204)

		webRouter.get '*', ErrorController.notFound

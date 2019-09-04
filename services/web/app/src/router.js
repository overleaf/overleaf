const AdminController = require('./Features/ServerAdmin/AdminController')
const ErrorController = require('./Features/Errors/ErrorController')
const ProjectController = require('./Features/Project/ProjectController')
const ProjectApiController = require('./Features/Project/ProjectApiController')
const SpellingController = require('./Features/Spelling/SpellingController')
const EditorRouter = require('./Features/Editor/EditorRouter')
const Settings = require('settings-sharelatex')
const TpdsController = require('./Features/ThirdPartyDataStore/TpdsController')
const SubscriptionRouter = require('./Features/Subscription/SubscriptionRouter')
const UploadsRouter = require('./Features/Uploads/UploadsRouter')
const metrics = require('metrics-sharelatex')
const ReferalController = require('./Features/Referal/ReferalController')
const AuthenticationController = require('./Features/Authentication/AuthenticationController')
const TagsController = require('./Features/Tags/TagsController')
const NotificationsController = require('./Features/Notifications/NotificationsController')
const CollaboratorsRouter = require('./Features/Collaborators/CollaboratorsRouter')
const UserInfoController = require('./Features/User/UserInfoController')
const UserController = require('./Features/User/UserController')
const UserEmailsController = require('./Features/User/UserEmailsController')
const UserPagesController = require('./Features/User/UserPagesController')
const DocumentController = require('./Features/Documents/DocumentController')
const CompileManager = require('./Features/Compile/CompileManager')
const CompileController = require('./Features/Compile/CompileController')
const ClsiCookieManager = require('./Features/Compile/ClsiCookieManager')(
  Settings.apis.clsi != null ? Settings.apis.clsi.backendGroupName : undefined
)
const HealthCheckController = require('./Features/HealthCheck/HealthCheckController')
const ProjectDownloadsController = require('./Features/Downloads/ProjectDownloadsController')
const FileStoreController = require('./Features/FileStore/FileStoreController')
const HistoryController = require('./Features/History/HistoryController')
const ExportsController = require('./Features/Exports/ExportsController')
const PasswordResetRouter = require('./Features/PasswordReset/PasswordResetRouter')
const StaticPagesRouter = require('./Features/StaticPages/StaticPagesRouter')
const ChatController = require('./Features/Chat/ChatController')
const BlogController = require('./Features/Blog/BlogController')
const Modules = require('./infrastructure/Modules')
const RateLimiterMiddleware = require('./Features/Security/RateLimiterMiddleware')
const RealTimeProxyRouter = require('./Features/RealTimeProxy/RealTimeProxyRouter')
const InactiveProjectController = require('./Features/InactiveData/InactiveProjectController')
const ContactRouter = require('./Features/Contacts/ContactRouter')
const ReferencesController = require('./Features/References/ReferencesController')
const AuthorizationMiddleware = require('./Features/Authorization/AuthorizationMiddleware')
const BetaProgramController = require('./Features/BetaProgram/BetaProgramController')
const SudoModeController = require('./Features/SudoMode/SudoModeController')
const SudoModeMiddleware = require('./Features/SudoMode/SudoModeMiddleware')
const AnalyticsRouter = require('./Features/Analytics/AnalyticsRouter')
const AnnouncementsController = require('./Features/Announcements/AnnouncementsController')
const MetaController = require('./Features/Metadata/MetaController')
const TokenAccessController = require('./Features/TokenAccess/TokenAccessController')
const Features = require('./infrastructure/Features')
const LinkedFilesRouter = require('./Features/LinkedFiles/LinkedFilesRouter')
const TemplatesRouter = require('./Features/Templates/TemplatesRouter')
const InstitutionsController = require('./Features/Institutions/InstitutionsController')
const UserMembershipRouter = require('./Features/UserMembership/UserMembershipRouter')

const logger = require('logger-sharelatex')
const _ = require('underscore')

module.exports = { initialize }

function initialize(webRouter, privateApiRouter, publicApiRouter) {
  if (!Settings.allowPublicAccess) {
    webRouter.all('*', AuthenticationController.requireGlobalLogin)
  }

  webRouter.get('/login', UserPagesController.loginPage)
  AuthenticationController.addEndpointToLoginWhitelist('/login')

  webRouter.post('/login', AuthenticationController.passportLogin)

  webRouter.get(
    '/read-only/one-time-login',
    UserPagesController.oneTimeLoginPage
  )
  AuthenticationController.addEndpointToLoginWhitelist(
    '/read-only/one-time-login'
  )

  webRouter.get('/logout', UserPagesController.logoutPage)
  webRouter.post('/logout', UserController.logout)

  webRouter.get('/restricted', AuthorizationMiddleware.restricted)

  if (Features.hasFeature('registration')) {
    webRouter.get('/register', UserPagesController.registerPage)
    AuthenticationController.addEndpointToLoginWhitelist('/register')
  }

  EditorRouter.apply(webRouter, privateApiRouter)
  CollaboratorsRouter.apply(webRouter, privateApiRouter)
  SubscriptionRouter.apply(webRouter, privateApiRouter, publicApiRouter)
  UploadsRouter.apply(webRouter, privateApiRouter)
  PasswordResetRouter.apply(webRouter, privateApiRouter)
  StaticPagesRouter.apply(webRouter, privateApiRouter)
  RealTimeProxyRouter.apply(webRouter, privateApiRouter)
  ContactRouter.apply(webRouter, privateApiRouter)
  AnalyticsRouter.apply(webRouter, privateApiRouter, publicApiRouter)
  LinkedFilesRouter.apply(webRouter, privateApiRouter, publicApiRouter)
  TemplatesRouter.apply(webRouter)
  UserMembershipRouter.apply(webRouter)

  Modules.applyRouter(webRouter, privateApiRouter, publicApiRouter)

  if (Settings.enableSubscriptions) {
    webRouter.get(
      '/user/bonus',
      AuthenticationController.requireLogin(),
      ReferalController.bonus
    )
  }

  if (Settings.overleaf == null) {
    webRouter.get('/blog', BlogController.getIndexPage)
    webRouter.get('/blog/*', BlogController.getPage)
  }

  webRouter.get('/user/activate', UserPagesController.activateAccountPage)
  AuthenticationController.addEndpointToLoginWhitelist('/user/activate')

  webRouter.get(
    '/user/settings',
    AuthenticationController.requireLogin(),
    SudoModeMiddleware.protectPage,
    UserPagesController.settingsPage
  )
  webRouter.post(
    '/user/settings',
    AuthenticationController.requireLogin(),
    UserController.updateUserSettings
  )
  webRouter.post(
    '/user/password/update',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit({
      endpointName: 'change-password',
      maxRequests: 10,
      timeInterval: 60
    }),
    UserController.changePassword
  )
  webRouter.get(
    '/user/emails',
    AuthenticationController.requireLogin(),
    UserEmailsController.list
  )
  webRouter.get('/user/emails/confirm', UserEmailsController.showConfirm)
  webRouter.post(
    '/user/emails/confirm',
    RateLimiterMiddleware.rateLimit({
      endpointName: 'confirm-email',
      maxRequests: 10,
      timeInterval: 60
    }),
    UserEmailsController.confirm
  )
  webRouter.post(
    '/user/emails/resend_confirmation',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit({
      endpointName: 'resend-confirmation',
      maxRequests: 10,
      timeInterval: 60
    }),
    UserEmailsController.resendConfirmation
  )

  if (Features.hasFeature('affiliations')) {
    webRouter.post(
      '/user/emails',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit({
        endpointName: 'add-email',
        maxRequests: 10,
        timeInterval: 60
      }),
      UserEmailsController.add
    )
    webRouter.post(
      '/user/emails/delete',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit({
        endpointName: 'delete-email',
        maxRequests: 10,
        timeInterval: 60
      }),
      UserEmailsController.remove
    )
    webRouter.post(
      '/user/emails/default',
      AuthenticationController.requireLogin(),
      UserEmailsController.setDefault
    )
    webRouter.post(
      '/user/emails/endorse',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit({
        endpointName: 'endorse-email',
        maxRequests: 30,
        timeInterval: 60
      }),
      UserEmailsController.endorse
    )
  }

  webRouter.get(
    '/user/sessions',
    AuthenticationController.requireLogin(),
    SudoModeMiddleware.protectPage,
    UserPagesController.sessionsPage
  )
  webRouter.post(
    '/user/sessions/clear',
    AuthenticationController.requireLogin(),
    UserController.clearSessions
  )

  webRouter.delete(
    '/user/newsletter/unsubscribe',
    AuthenticationController.requireLogin(),
    UserController.unsubscribe
  )
  webRouter.post(
    '/user/delete',
    RateLimiterMiddleware.rateLimit({
      endpointName: 'delete-user',
      maxRequests: 10,
      timeInterval: 60
    }),
    AuthenticationController.requireLogin(),
    UserController.tryDeleteUser
  )

  webRouter.get(
    '/user/personal_info',
    AuthenticationController.requireLogin(),
    UserInfoController.getLoggedInUsersPersonalInfo
  )
  privateApiRouter.get(
    '/user/:user_id/personal_info',
    AuthenticationController.httpAuth,
    UserInfoController.getPersonalInfo
  )

  webRouter.get(
    '/user/reconfirm',
    UserPagesController.renderReconfirmAccountPage
  )
  // for /user/reconfirm POST, see password router

  webRouter.get(
    '/user/projects',
    AuthenticationController.requireLogin(),
    ProjectController.userProjectsJson
  )
  webRouter.get(
    '/project/:Project_id/entities',
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.ensureUserCanReadProject,
    ProjectController.projectEntitiesJson
  )

  webRouter.get(
    '/project',
    AuthenticationController.requireLogin(),
    ProjectController.projectListPage
  )
  webRouter.post(
    '/project/new',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit({
      endpointName: 'create-project',
      maxRequests: 20,
      timeInterval: 60
    }),
    ProjectController.newProject
  )

  webRouter.get(
    '/Project/:Project_id',
    RateLimiterMiddleware.rateLimit({
      endpointName: 'open-project',
      params: ['Project_id'],
      maxRequests: 15,
      timeInterval: 60
    }),
    AuthorizationMiddleware.ensureUserCanReadProject,
    ProjectController.loadEditor
  )
  webRouter.head(
    '/Project/:Project_id/file/:File_id',
    AuthorizationMiddleware.ensureUserCanReadProject,
    FileStoreController.getFileHead
  )
  webRouter.get(
    '/Project/:Project_id/file/:File_id',
    AuthorizationMiddleware.ensureUserCanReadProject,
    FileStoreController.getFile
  )
  webRouter.post(
    '/project/:Project_id/settings',
    AuthorizationMiddleware.ensureUserCanWriteProjectSettings,
    ProjectController.updateProjectSettings
  )
  webRouter.post(
    '/project/:Project_id/settings/admin',
    AuthorizationMiddleware.ensureUserCanAdminProject,
    ProjectController.updateProjectAdminSettings
  )

  webRouter.post(
    '/project/:Project_id/compile',
    RateLimiterMiddleware.rateLimit({
      endpointName: 'compile-project-http',
      params: ['Project_id'],
      maxRequests: 800,
      timeInterval: 60 * 60
    }),
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.compile
  )

  webRouter.post(
    '/project/:Project_id/compile/stop',
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.stopCompile
  )

  // LEGACY: Used by the web download buttons, adds filename header, TODO: remove at some future date
  webRouter.get(
    '/project/:Project_id/output/output.pdf',
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.downloadPdf
  )

  // PDF Download button
  webRouter.get(
    /^\/download\/project\/([^/]*)\/output\/output\.pdf$/,
    function(req, res, next) {
      const params = { Project_id: req.params[0] }
      req.params = params
      next()
    },
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.downloadPdf
  )

  // PDF Download button for specific build
  webRouter.get(
    /^\/download\/project\/([^/]*)\/build\/([0-9a-f-]+)\/output\/output\.pdf$/,
    function(req, res, next) {
      const params = {
        Project_id: req.params[0],
        build_id: req.params[1]
      }
      req.params = params
      next()
    },
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.downloadPdf
  )

  // Used by the pdf viewers
  webRouter.get(
    /^\/project\/([^/]*)\/output\/(.*)$/,
    function(req, res, next) {
      const params = {
        Project_id: req.params[0],
        file: req.params[1]
      }
      req.params = params
      next()
    },
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.getFileFromClsi
  )
  // direct url access to output files for a specific build (query string not required)
  webRouter.get(
    /^\/project\/([^/]*)\/build\/([0-9a-f-]+)\/output\/(.*)$/,
    function(req, res, next) {
      const params = {
        Project_id: req.params[0],
        build_id: req.params[1],
        file: req.params[2]
      }
      req.params = params
      next()
    },
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.getFileFromClsi
  )

  // direct url access to output files for user but no build, to retrieve files when build fails
  webRouter.get(
    /^\/project\/([^/]*)\/user\/([0-9a-f-]+)\/output\/(.*)$/,
    function(req, res, next) {
      const params = {
        Project_id: req.params[0],
        user_id: req.params[1],
        file: req.params[2]
      }
      req.params = params
      next()
    },
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.getFileFromClsi
  )

  // direct url access to output files for a specific user and build (query string not required)
  webRouter.get(
    /^\/project\/([^/]*)\/user\/([0-9a-f]+)\/build\/([0-9a-f-]+)\/output\/(.*)$/,
    function(req, res, next) {
      const params = {
        Project_id: req.params[0],
        user_id: req.params[1],
        build_id: req.params[2],
        file: req.params[3]
      }
      req.params = params
      next()
    },
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.getFileFromClsi
  )

  webRouter.delete(
    '/project/:Project_id/output',
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.deleteAuxFiles
  )
  webRouter.get(
    '/project/:Project_id/sync/code',
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.proxySyncCode
  )
  webRouter.get(
    '/project/:Project_id/sync/pdf',
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.proxySyncPdf
  )
  webRouter.get(
    '/project/:Project_id/wordcount',
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.wordCount
  )

  webRouter.delete(
    '/Project/:Project_id',
    AuthorizationMiddleware.ensureUserCanAdminProject,
    ProjectController.deleteProject
  )
  webRouter.post(
    '/Project/:Project_id/restore',
    AuthorizationMiddleware.ensureUserCanAdminProject,
    ProjectController.restoreProject
  )
  webRouter.post(
    '/Project/:Project_id/clone',
    AuthorizationMiddleware.ensureUserCanReadProject,
    ProjectController.cloneProject
  )

  webRouter.post(
    '/project/:Project_id/rename',
    AuthorizationMiddleware.ensureUserCanAdminProject,
    ProjectController.renameProject
  )

  webRouter.get(
    '/project/:Project_id/updates',
    AuthorizationMiddleware.ensureUserCanReadProject,
    HistoryController.selectHistoryApi,
    HistoryController.proxyToHistoryApiAndInjectUserDetails
  )
  webRouter.get(
    '/project/:Project_id/doc/:doc_id/diff',
    AuthorizationMiddleware.ensureUserCanReadProject,
    HistoryController.selectHistoryApi,
    HistoryController.proxyToHistoryApi
  )
  webRouter.get(
    '/project/:Project_id/diff',
    AuthorizationMiddleware.ensureUserCanReadProject,
    HistoryController.selectHistoryApi,
    HistoryController.proxyToHistoryApiAndInjectUserDetails
  )
  webRouter.get(
    '/project/:Project_id/filetree/diff',
    AuthorizationMiddleware.ensureUserCanReadProject,
    HistoryController.selectHistoryApi,
    HistoryController.proxyToHistoryApi
  )
  webRouter.post(
    '/project/:Project_id/doc/:doc_id/version/:version_id/restore',
    AuthorizationMiddleware.ensureUserCanWriteProjectContent,
    HistoryController.selectHistoryApi,
    HistoryController.proxyToHistoryApi
  )
  webRouter.post(
    '/project/:project_id/doc/:doc_id/restore',
    AuthorizationMiddleware.ensureUserCanWriteProjectContent,
    HistoryController.restoreDocFromDeletedDoc
  )
  webRouter.post(
    '/project/:project_id/restore_file',
    AuthorizationMiddleware.ensureUserCanWriteProjectContent,
    HistoryController.restoreFileFromV2
  )
  webRouter.get(
    '/project/:project_id/version/:version/zip',
    AuthorizationMiddleware.ensureUserCanReadProject,
    HistoryController.downloadZipOfVersion
  )
  privateApiRouter.post(
    '/project/:Project_id/history/resync',
    AuthenticationController.httpAuth,
    HistoryController.resyncProjectHistory
  )

  webRouter.get(
    '/project/:Project_id/labels',
    AuthorizationMiddleware.ensureUserCanReadProject,
    HistoryController.selectHistoryApi,
    HistoryController.ensureProjectHistoryEnabled,
    HistoryController.getLabels
  )
  webRouter.post(
    '/project/:Project_id/labels',
    AuthorizationMiddleware.ensureUserCanWriteProjectContent,
    HistoryController.selectHistoryApi,
    HistoryController.ensureProjectHistoryEnabled,
    HistoryController.createLabel
  )
  webRouter.delete(
    '/project/:Project_id/labels/:label_id',
    AuthorizationMiddleware.ensureUserCanWriteProjectContent,
    HistoryController.selectHistoryApi,
    HistoryController.ensureProjectHistoryEnabled,
    HistoryController.deleteLabel
  )

  webRouter.post(
    '/project/:project_id/export/:brand_variation_id',
    AuthorizationMiddleware.ensureUserCanWriteProjectContent,
    ExportsController.exportProject
  )
  webRouter.get(
    '/project/:project_id/export/:export_id',
    AuthorizationMiddleware.ensureUserCanWriteProjectContent,
    ExportsController.exportStatus
  )
  webRouter.get(
    '/project/:project_id/export/:export_id/:type',
    AuthorizationMiddleware.ensureUserCanWriteProjectContent,
    ExportsController.exportDownload
  )

  webRouter.get(
    '/Project/:Project_id/download/zip',
    AuthorizationMiddleware.ensureUserCanReadProject,
    ProjectDownloadsController.downloadProject
  )
  webRouter.get(
    '/project/download/zip',
    AuthorizationMiddleware.ensureUserCanReadMultipleProjects,
    ProjectDownloadsController.downloadMultipleProjects
  )

  webRouter.get(
    '/project/:project_id/metadata',
    AuthorizationMiddleware.ensureUserCanReadProject,
    AuthenticationController.requireLogin(),
    MetaController.getMetadata
  )
  webRouter.post(
    '/project/:project_id/doc/:doc_id/metadata',
    AuthorizationMiddleware.ensureUserCanReadProject,
    AuthenticationController.requireLogin(),
    MetaController.broadcastMetadataForDoc
  )

  privateApiRouter.post(
    '/internal/expire-deleted-projects-after-duration',
    AuthenticationController.httpAuth,
    ProjectController.expireDeletedProjectsAfterDuration
  )
  privateApiRouter.post(
    '/internal/expire-deleted-users-after-duration',
    AuthenticationController.httpAuth,
    UserController.expireDeletedUsersAfterDuration
  )
  privateApiRouter.post(
    '/internal/project/:projectId/expire-deleted-project',
    AuthenticationController.httpAuth,
    ProjectController.expireDeletedProject
  )
  privateApiRouter.post(
    '/internal/users/:userId/expire',
    AuthenticationController.httpAuth,
    UserController.expireDeletedUser
  )

  webRouter.get(
    '/tag',
    AuthenticationController.requireLogin(),
    TagsController.getAllTags
  )
  webRouter.post(
    '/tag',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit({
      endpointName: 'create-tag',
      maxRequests: 30,
      timeInterval: 60
    }),
    TagsController.createTag
  )
  webRouter.post(
    '/tag/:tag_id/rename',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit({
      endpointName: 'rename-tag',
      maxRequests: 30,
      timeInterval: 60
    }),
    TagsController.renameTag
  )
  webRouter.delete(
    '/tag/:tag_id',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit({
      endpointName: 'delete-tag',
      maxRequests: 30,
      timeInterval: 60
    }),
    TagsController.deleteTag
  )
  webRouter.post(
    '/tag/:tag_id/project/:project_id',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit({
      endpointName: 'add-project-to-tag',
      maxRequests: 30,
      timeInterval: 60
    }),
    TagsController.addProjectToTag
  )
  webRouter.delete(
    '/tag/:tag_id/project/:project_id',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit({
      endpointName: 'remove-project-from-tag',
      maxRequests: 30,
      timeInterval: 60
    }),
    TagsController.removeProjectFromTag
  )

  webRouter.get(
    '/notifications',
    AuthenticationController.requireLogin(),
    NotificationsController.getAllUnreadNotifications
  )
  webRouter.delete(
    '/notifications/:notification_id',
    AuthenticationController.requireLogin(),
    NotificationsController.markNotificationAsRead
  )

  webRouter.get(
    '/announcements',
    AuthenticationController.requireLogin(),
    AnnouncementsController.getUndreadAnnouncements
  )

  // Deprecated in favour of /internal/project/:project_id but still used by versioning
  privateApiRouter.get(
    '/project/:project_id/details',
    AuthenticationController.httpAuth,
    ProjectApiController.getProjectDetails
  )

  // New 'stable' /internal API end points
  privateApiRouter.get(
    '/internal/project/:project_id',
    AuthenticationController.httpAuth,
    ProjectApiController.getProjectDetails
  )
  privateApiRouter.get(
    '/internal/project/:Project_id/zip',
    AuthenticationController.httpAuth,
    ProjectDownloadsController.downloadProject
  )
  privateApiRouter.get(
    '/internal/project/:project_id/compile/pdf',
    AuthenticationController.httpAuth,
    CompileController.compileAndDownloadPdf
  )

  privateApiRouter.post(
    '/internal/deactivateOldProjects',
    AuthenticationController.httpAuth,
    InactiveProjectController.deactivateOldProjects
  )
  privateApiRouter.post(
    '/internal/project/:project_id/deactivate',
    AuthenticationController.httpAuth,
    InactiveProjectController.deactivateProject
  )

  webRouter.get(
    /^\/internal\/project\/([^/]*)\/output\/(.*)$/,
    function(req, res, next) {
      const params = {
        Project_id: req.params[0],
        file: req.params[1]
      }
      req.params = params
      next()
    },
    AuthenticationController.httpAuth,
    CompileController.getFileFromClsi
  )

  privateApiRouter.get(
    '/project/:Project_id/doc/:doc_id',
    AuthenticationController.httpAuth,
    DocumentController.getDocument
  )
  privateApiRouter.post(
    '/project/:Project_id/doc/:doc_id',
    AuthenticationController.httpAuth,
    DocumentController.setDocument
  )

  privateApiRouter.post(
    '/user/:user_id/update/*',
    AuthenticationController.httpAuth,
    TpdsController.mergeUpdate
  )
  privateApiRouter.delete(
    '/user/:user_id/update/*',
    AuthenticationController.httpAuth,
    TpdsController.deleteUpdate
  )

  privateApiRouter.post(
    '/project/:project_id/contents/*',
    AuthenticationController.httpAuth,
    TpdsController.updateProjectContents
  )
  privateApiRouter.delete(
    '/project/:project_id/contents/*',
    AuthenticationController.httpAuth,
    TpdsController.deleteProjectContents
  )

  webRouter.post(
    '/spelling/check',
    AuthenticationController.requireLogin(),
    SpellingController.proxyRequestToSpellingApi
  )
  webRouter.post(
    '/spelling/learn',
    AuthenticationController.requireLogin(),
    SpellingController.proxyRequestToSpellingApi
  )

  webRouter.get(
    '/project/:project_id/messages',
    AuthorizationMiddleware.ensureUserCanReadProject,
    ChatController.getMessages
  )
  webRouter.post(
    '/project/:project_id/messages',
    AuthorizationMiddleware.ensureUserCanReadProject,
    RateLimiterMiddleware.rateLimit({
      endpointName: 'send-chat-message',
      maxRequests: 100,
      timeInterval: 60
    }),
    ChatController.sendMessage
  )

  webRouter.post(
    '/project/:Project_id/references/index',
    AuthorizationMiddleware.ensureUserCanReadProject,
    RateLimiterMiddleware.rateLimit({
      endpointName: 'index-project-references',
      maxRequests: 30,
      timeInterval: 60
    }),
    ReferencesController.index
  )
  webRouter.post(
    '/project/:Project_id/references/indexAll',
    AuthorizationMiddleware.ensureUserCanReadProject,
    RateLimiterMiddleware.rateLimit({
      endpointName: 'index-all-project-references',
      maxRequests: 30,
      timeInterval: 60
    }),
    ReferencesController.indexAll
  )

  // disable beta program while v2 is in beta
  webRouter.get(
    '/beta/participate',
    AuthenticationController.requireLogin(),
    BetaProgramController.optInPage
  )
  webRouter.post(
    '/beta/opt-in',
    AuthenticationController.requireLogin(),
    BetaProgramController.optIn
  )
  webRouter.post(
    '/beta/opt-out',
    AuthenticationController.requireLogin(),
    BetaProgramController.optOut
  )
  webRouter.get(
    '/confirm-password',
    AuthenticationController.requireLogin(),
    SudoModeController.sudoModePrompt
  )
  webRouter.post(
    '/confirm-password',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit({
      endpointName: 'confirm-password',
      maxRequests: 10,
      timeInterval: 60
    }),
    SudoModeController.submitPassword
  )

  // New "api" endpoints. Started as a way for v1 to call over to v2 (for
  // long-term features, as opposed to the nominally temporary ones in the
  // overleaf-integration module), but may expand beyond that role.
  publicApiRouter.post(
    '/api/clsi/compile/:submission_id',
    AuthenticationController.httpAuth,
    CompileController.compileSubmission
  )
  publicApiRouter.get(
    /^\/api\/clsi\/compile\/([^/]*)\/build\/([0-9a-f-]+)\/output\/(.*)$/,
    function(req, res, next) {
      const params = {
        submission_id: req.params[0],
        build_id: req.params[1],
        file: req.params[2]
      }
      req.params = params
      next()
    },
    AuthenticationController.httpAuth,
    CompileController.getFileFromClsiWithoutUser
  )
  publicApiRouter.post(
    '/api/institutions/confirm_university_domain',
    RateLimiterMiddleware.rateLimit({
      endpointName: 'confirm-university-domain',
      maxRequests: 1,
      timeInterval: 60
    }),
    AuthenticationController.httpAuth,
    InstitutionsController.confirmDomain
  )

  webRouter.get('/chrome', function(req, res, next) {
    // Match v1 behaviour - this is used for a Chrome web app
    if (AuthenticationController.isUserLoggedIn(req)) {
      res.redirect('/project')
    } else {
      res.redirect('/register')
    }
  })

  // Admin Stuff
  webRouter.get(
    '/admin',
    AuthorizationMiddleware.ensureUserIsSiteAdmin,
    AdminController.index
  )
  webRouter.get(
    '/admin/user',
    AuthorizationMiddleware.ensureUserIsSiteAdmin,
    (req, res) => res.redirect('/admin/register')
  ) // this gets removed by admin-panel addon
  webRouter.get(
    '/admin/register',
    AuthorizationMiddleware.ensureUserIsSiteAdmin,
    AdminController.registerNewUser
  )
  webRouter.post(
    '/admin/register',
    AuthorizationMiddleware.ensureUserIsSiteAdmin,
    UserController.register
  )
  webRouter.post(
    '/admin/closeEditor',
    AuthorizationMiddleware.ensureUserIsSiteAdmin,
    AdminController.closeEditor
  )
  webRouter.post(
    '/admin/dissconectAllUsers',
    AuthorizationMiddleware.ensureUserIsSiteAdmin,
    AdminController.dissconectAllUsers
  )
  webRouter.post(
    '/admin/flushProjectToTpds',
    AuthorizationMiddleware.ensureUserIsSiteAdmin,
    AdminController.flushProjectToTpds
  )
  webRouter.post(
    '/admin/pollDropboxForUser',
    AuthorizationMiddleware.ensureUserIsSiteAdmin,
    AdminController.pollDropboxForUser
  )
  webRouter.post(
    '/admin/messages',
    AuthorizationMiddleware.ensureUserIsSiteAdmin,
    AdminController.createMessage
  )
  webRouter.post(
    '/admin/messages/clear',
    AuthorizationMiddleware.ensureUserIsSiteAdmin,
    AdminController.clearMessages
  )

  privateApiRouter.post(
    '/disconnectAllUsers',
    AdminController.dissconectAllUsers
  )

  privateApiRouter.get('/perfTest', (req, res) => res.send('hello'))

  publicApiRouter.get('/status', (req, res) =>
    res.send('web sharelatex is alive (web)')
  )
  privateApiRouter.get('/status', (req, res) =>
    res.send('web sharelatex is alive (api)')
  )

  webRouter.get('/dev/csrf', (req, res) => res.send(res.locals.csrfToken))

  publicApiRouter.get('/health_check', HealthCheckController.check)
  privateApiRouter.get('/health_check', HealthCheckController.check)

  publicApiRouter.get('/health_check/redis', HealthCheckController.checkRedis)
  privateApiRouter.get('/health_check/redis', HealthCheckController.checkRedis)

  publicApiRouter.get('/health_check/mongo', HealthCheckController.checkMongo)
  privateApiRouter.get('/health_check/mongo', HealthCheckController.checkMongo)

  webRouter.get(
    '/status/compiler/:Project_id',
    AuthorizationMiddleware.ensureUserCanReadProject,
    function(req, res) {
      const projectId = req.params.Project_id
      const sendRes = _.once(function(statusCode, message) {
        res.status(statusCode)
        res.send(message)
        ClsiCookieManager.clearServerId(projectId)
      }) // force every compile to a new server
      // set a timeout
      var handler = setTimeout(function() {
        sendRes(500, 'Compiler timed out')
        handler = null
      }, 10000)
      // use a valid user id for testing
      const testUserId = '123456789012345678901234'
      // run the compile
      CompileManager.compile(projectId, testUserId, {}, function(
        error,
        status
      ) {
        if (handler) {
          clearTimeout(handler)
        }
        if (error) {
          sendRes(500, `Compiler returned error ${error.message}`)
        } else if (status === 'success') {
          sendRes(200, 'Compiler returned in less than 10 seconds')
        } else {
          sendRes(500, `Compiler returned failure ${status}`)
        }
      })
    }
  )

  webRouter.get('/no-cache', function(req, res, next) {
    res.header('Cache-Control', 'max-age=0')
    res.sendStatus(404)
  })

  webRouter.get('/oops-express', (req, res, next) =>
    next(new Error('Test error'))
  )
  webRouter.get('/oops-internal', function(req, res, next) {
    throw new Error('Test error')
  })
  webRouter.get('/oops-mongo', (req, res, next) =>
    require('./models/Project').Project.findOne({}, function() {
      throw new Error('Test error')
    })
  )

  privateApiRouter.get('/opps-small', function(req, res, next) {
    logger.err('test error occured')
    res.send()
  })

  webRouter.post('/error/client', function(req, res, next) {
    logger.warn(
      { err: req.body.error, meta: req.body.meta },
      'client side error'
    )
    metrics.inc('client-side-error')
    res.sendStatus(204)
  })

  webRouter.get(
    '/read/:read_only_token([a-z]+)',
    RateLimiterMiddleware.rateLimit({
      endpointName: 'read-only-token',
      maxRequests: 15,
      timeInterval: 60
    }),
    TokenAccessController.readOnlyToken
  )

  webRouter.get(
    '/:read_and_write_token([0-9]+[a-z]+)',
    RateLimiterMiddleware.rateLimit({
      endpointName: 'read-and-write-token',
      maxRequests: 15,
      timeInterval: 60
    }),
    TokenAccessController.readAndWriteToken
  )

  webRouter.get('*', ErrorController.notFound)
}

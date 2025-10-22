import AdminController from './Features/ServerAdmin/AdminController.mjs'
import ErrorController from './Features/Errors/ErrorController.mjs'
import Features from './infrastructure/Features.js'
import ProjectController from './Features/Project/ProjectController.mjs'
import ProjectApiController from './Features/Project/ProjectApiController.mjs'
import ProjectListController from './Features/Project/ProjectListController.mjs'
import SpellingController from './Features/Spelling/SpellingController.mjs'
import EditorRouter from './Features/Editor/EditorRouter.mjs'
import Settings from '@overleaf/settings'
import TpdsController from './Features/ThirdPartyDataStore/TpdsController.mjs'
import SubscriptionRouter from './Features/Subscription/SubscriptionRouter.mjs'
import UploadsRouter from './Features/Uploads/UploadsRouter.mjs'
import metrics from '@overleaf/metrics'
import ReferalController from './Features/Referal/ReferalController.mjs'
import AuthenticationController from './Features/Authentication/AuthenticationController.mjs'
import PermissionsController from './Features/Authorization/PermissionsController.mjs'
import SessionManager from './Features/Authentication/SessionManager.mjs'
import TagsController from './Features/Tags/TagsController.mjs'
import NotificationsController from './Features/Notifications/NotificationsController.mjs'
import CollaboratorsRouter from './Features/Collaborators/CollaboratorsRouter.mjs'
import UserInfoController from './Features/User/UserInfoController.mjs'
import UserController from './Features/User/UserController.mjs'
import UserEmailsController from './Features/User/UserEmailsController.mjs'
import UserPagesController from './Features/User/UserPagesController.mjs'
import TutorialController from './Features/Tutorial/TutorialController.mjs'
import DocumentController from './Features/Documents/DocumentController.mjs'
import CompileManager from './Features/Compile/CompileManager.mjs'
import CompileController from './Features/Compile/CompileController.mjs'
import HealthCheckController from './Features/HealthCheck/HealthCheckController.mjs'
import ProjectDownloadsController from './Features/Downloads/ProjectDownloadsController.mjs'
import FileStoreController from './Features/FileStore/FileStoreController.mjs'
import DocumentUpdaterController from './Features/DocumentUpdater/DocumentUpdaterController.mjs'
import HistoryRouter from './Features/History/HistoryRouter.mjs'
import ExportsController from './Features/Exports/ExportsController.mjs'
import PasswordResetRouter from './Features/PasswordReset/PasswordResetRouter.mjs'
import StaticPagesRouter from './Features/StaticPages/StaticPagesRouter.mjs'
import ChatController from './Features/Chat/ChatController.mjs'
import Modules from './infrastructure/Modules.js'
import {
  RateLimiter,
  openProjectRateLimiter,
  overleafLoginRateLimiter,
} from './infrastructure/RateLimiter.js'
import RateLimiterMiddleware from './Features/Security/RateLimiterMiddleware.mjs'
import InactiveProjectController from './Features/InactiveData/InactiveProjectController.mjs'
import ContactRouter from './Features/Contacts/ContactRouter.mjs'
import ReferencesController from './Features/References/ReferencesController.mjs'
import AuthorizationMiddleware from './Features/Authorization/AuthorizationMiddleware.mjs'
import BetaProgramController from './Features/BetaProgram/BetaProgramController.mjs'
import AnalyticsRouter from './Features/Analytics/AnalyticsRouter.mjs'
import MetaController from './Features/Metadata/MetaController.mjs'
import TokenAccessController from './Features/TokenAccess/TokenAccessController.mjs'
import TokenAccessRouter from './Features/TokenAccess/TokenAccessRouter.mjs'
import LinkedFilesRouter from './Features/LinkedFiles/LinkedFilesRouter.mjs'
import TemplatesRouter from './Features/Templates/TemplatesRouter.mjs'
import UserMembershipRouter from './Features/UserMembership/UserMembershipRouter.mjs'
import SystemMessageController from './Features/SystemMessages/SystemMessageController.mjs'
import AnalyticsRegistrationSourceMiddleware from './Features/Analytics/AnalyticsRegistrationSourceMiddleware.mjs'
import AnalyticsUTMTrackingMiddleware from './Features/Analytics/AnalyticsUTMTrackingMiddleware.mjs'
import CaptchaMiddleware from './Features/Captcha/CaptchaMiddleware.mjs'
import UnsupportedBrowserMiddleware from './infrastructure/UnsupportedBrowserMiddleware.mjs'
import logger from '@overleaf/logger'
import _ from 'lodash'
import { plainTextResponse } from './infrastructure/Response.js'
import SocketDiagnostics from './Features/SocketDiagnostics/SocketDiagnostics.mjs'
import ClsiCacheController from './Features/Compile/ClsiCacheController.mjs'
import AsyncLocalStorage from './infrastructure/AsyncLocalStorage.js'

const { renderUnsupportedBrowserPage, unsupportedBrowserMiddleware } =
  UnsupportedBrowserMiddleware

const rateLimiters = {
  addEmail: new RateLimiter('add-email', {
    points: 10,
    duration: 60,
  }),
  addProjectToTag: new RateLimiter('add-project-to-tag', {
    points: 30,
    duration: 60,
  }),
  addProjectsToTag: new RateLimiter('add-projects-to-tag', {
    points: 30,
    duration: 60,
  }),
  canSkipCaptcha: new RateLimiter('can-skip-captcha', {
    points: 20,
    duration: 60,
  }),
  changePassword: new RateLimiter('change-password', {
    points: 10,
    duration: 60,
  }),
  compileProjectHttp: new RateLimiter('compile-project-http', {
    points: 800,
    duration: 60 * 60,
  }),
  confirmEmail: new RateLimiter('confirm-email', {
    points: 10,
    duration: 60,
  }),
  createProject: new RateLimiter('create-project', {
    points: 20,
    duration: 60,
  }),
  createTag: new RateLimiter('create-tag', {
    points: 30,
    duration: 60,
  }),
  deleteEmail: new RateLimiter('delete-email', {
    points: 10,
    duration: 60,
  }),
  deleteTag: new RateLimiter('delete-tag', {
    points: 30,
    duration: 60,
  }),
  deleteUser: new RateLimiter('delete-user', {
    points: 10,
    duration: 60,
  }),
  endorseEmail: new RateLimiter('endorse-email', {
    points: 30,
    duration: 60,
  }),
  getProjects: new RateLimiter('get-projects', {
    points: 30,
    duration: 60,
  }),
  grantTokenAccessReadOnly: new RateLimiter('grant-token-access-read-only', {
    points: 10,
    duration: 60,
  }),
  grantTokenAccessReadWrite: new RateLimiter('grant-token-access-read-write', {
    points: 10,
    duration: 60,
  }),
  indexAllProjectReferences: new RateLimiter('index-all-project-references', {
    points: 30,
    duration: 60,
  }),
  miscOutputDownload: new RateLimiter('misc-output-download', {
    points: 1000,
    duration: 60 * 60,
  }),
  multipleProjectsZipDownload: new RateLimiter(
    'multiple-projects-zip-download',
    {
      points: 10,
      duration: 60,
    }
  ),
  openDashboard: new RateLimiter('open-dashboard', {
    points: 30,
    duration: 60,
  }),
  readAndWriteToken: new RateLimiter('read-and-write-token', {
    points: 15,
    duration: 60,
  }),
  readOnlyToken: new RateLimiter('read-only-token', {
    points: 15,
    duration: 60,
  }),
  removeProjectFromTag: new RateLimiter('remove-project-from-tag', {
    points: 30,
    duration: 60,
  }),
  removeProjectsFromTag: new RateLimiter('remove-projects-from-tag', {
    points: 30,
    duration: 60,
  }),
  renameTag: new RateLimiter('rename-tag', {
    points: 30,
    duration: 60,
  }),
  resendConfirmation: new RateLimiter('resend-confirmation', {
    points: 1,
    duration: 60,
  }),
  sendConfirmation: new RateLimiter('send-confirmation', {
    points: 2,
    duration: 60,
  }),
  sendChatMessage: new RateLimiter('send-chat-message', {
    points: 100,
    duration: 60,
  }),
  statusCompiler: new RateLimiter('status-compiler', {
    points: 10,
    duration: 60,
  }),
  zipDownload: new RateLimiter('zip-download', {
    points: 10,
    duration: 60,
  }),
}

async function initialize(webRouter, privateApiRouter, publicApiRouter) {
  webRouter.use(unsupportedBrowserMiddleware)

  if (!Settings.allowPublicAccess) {
    webRouter.all('*', AuthenticationController.requireGlobalLogin)
  }

  webRouter.get('*', AnalyticsRegistrationSourceMiddleware.setInbound())
  webRouter.get('*', AnalyticsUTMTrackingMiddleware.recordUTMTags())

  // Mount onto /login in order to get the deviceHistory cookie.
  webRouter.post(
    '/login/can-skip-captcha',
    // Keep in sync with the overleaf-login options.
    RateLimiterMiddleware.rateLimit(rateLimiters.canSkipCaptcha),
    CaptchaMiddleware.canSkipCaptcha
  )

  webRouter.get('/login', UserPagesController.loginPage)
  AuthenticationController.addEndpointToLoginWhitelist('/login')

  webRouter.post(
    '/login',
    RateLimiterMiddleware.rateLimit(overleafLoginRateLimiter), // rate limit IP (20 / 60s)
    RateLimiterMiddleware.loginRateLimitEmail(), // rate limit email (10 / 120s)
    CaptchaMiddleware.validateCaptcha('login'),
    AuthenticationController.passportLogin
  )

  webRouter.get(
    '/compromised-password',
    AuthenticationController.requireLogin(),
    UserPagesController.compromisedPasswordPage
  )

  webRouter.get('/account-suspended', UserPagesController.accountSuspended)

  webRouter.get(
    '/socket-diagnostics',
    AuthenticationController.requireLogin(),
    SocketDiagnostics.index
  )

  if (Settings.enableLegacyLogin) {
    AuthenticationController.addEndpointToLoginWhitelist('/login/legacy')
    webRouter.get('/login/legacy', UserPagesController.loginPage)
    webRouter.post(
      '/login/legacy',
      RateLimiterMiddleware.rateLimit(overleafLoginRateLimiter), // rate limit IP (20 / 60s)
      RateLimiterMiddleware.loginRateLimitEmail(), // rate limit email (10 / 120s)
      CaptchaMiddleware.validateCaptcha('login'),
      AuthenticationController.passportLogin
    )
  }

  webRouter.get(
    '/read-only/one-time-login',
    UserPagesController.oneTimeLoginPage
  )
  AuthenticationController.addEndpointToLoginWhitelist(
    '/read-only/one-time-login'
  )

  webRouter.post('/logout', UserController.logout)

  webRouter.get('/restricted', AuthorizationMiddleware.restricted)

  if (Features.hasFeature('registration-page')) {
    webRouter.get('/register', UserPagesController.registerPage)
    AuthenticationController.addEndpointToLoginWhitelist('/register')
  }

  EditorRouter.apply(webRouter, privateApiRouter)
  CollaboratorsRouter.apply(webRouter, privateApiRouter)
  SubscriptionRouter.apply(webRouter, privateApiRouter, publicApiRouter)
  UploadsRouter.apply(webRouter, privateApiRouter)
  PasswordResetRouter.apply(webRouter, privateApiRouter)
  StaticPagesRouter.apply(webRouter, privateApiRouter)
  ContactRouter.apply(webRouter, privateApiRouter)
  AnalyticsRouter.apply(webRouter, privateApiRouter, publicApiRouter)
  LinkedFilesRouter.apply(webRouter, privateApiRouter, publicApiRouter)
  TemplatesRouter.apply(webRouter)
  UserMembershipRouter.apply(webRouter)
  TokenAccessRouter.apply(webRouter)
  HistoryRouter.apply(webRouter, privateApiRouter)

  await Modules.applyRouter(webRouter, privateApiRouter, publicApiRouter)

  if (Settings.enableSubscriptions) {
    webRouter.get(
      '/user/bonus',
      AuthenticationController.requireLogin(),
      ReferalController.bonus
    )
  }

  // .getMessages will generate an empty response for anonymous users.
  webRouter.get('/system/messages', SystemMessageController.getMessages)

  webRouter.get(
    '/user/settings',
    AuthenticationController.requireLogin(),
    PermissionsController.useCapabilities(),
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
    RateLimiterMiddleware.rateLimit(rateLimiters.changePassword),
    PermissionsController.requirePermission('change-password'),
    UserController.changePassword
  )
  webRouter.get(
    '/user/emails',
    AuthenticationController.requireLogin(),
    AsyncLocalStorage.middleware,
    PermissionsController.useCapabilities(),
    UserController.ensureAffiliationMiddleware,
    UserEmailsController.list
  )
  webRouter.get(
    '/user/emails/confirm',
    AuthenticationController.requireLogin(),
    UserEmailsController.showConfirm
  )
  webRouter.post(
    '/user/emails/confirm',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.confirmEmail),
    UserEmailsController.confirm
  )

  webRouter.post(
    '/user/emails/send-confirmation-code',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.sendConfirmation),
    await Modules.middleware('confirmationEmailMiddleware'),
    UserEmailsController.sendExistingEmailConfirmationCode
  )

  webRouter.post(
    '/user/emails/resend-confirmation-code',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.resendConfirmation),
    UserEmailsController.resendExistingSecondaryEmailConfirmationCode
  )

  webRouter.post(
    '/user/emails/confirm-code',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.confirmEmail),
    UserEmailsController.checkExistingEmailConfirmationCode
  )

  webRouter.get(
    '/user/emails/primary-email-check',
    AuthenticationController.requireLogin(),
    UserEmailsController.primaryEmailCheckPage
  )

  webRouter.post(
    '/user/emails/primary-email-check',
    AuthenticationController.requireLogin(),
    PermissionsController.useCapabilities(),
    UserEmailsController.primaryEmailCheck
  )

  if (Features.hasFeature('affiliations')) {
    webRouter.post(
      '/user/emails/delete',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(rateLimiters.deleteEmail),
      await Modules.middleware('userDeleteEmail'),
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
      PermissionsController.requirePermission('endorse-email'),
      RateLimiterMiddleware.rateLimit(rateLimiters.endorseEmail),
      UserEmailsController.endorse
    )
  }

  if (Features.hasFeature('saas')) {
    webRouter.get(
      '/user/emails/add-secondary',
      AuthenticationController.requireLogin(),
      PermissionsController.requirePermission('add-secondary-email'),
      UserEmailsController.addSecondaryEmailPage
    )

    webRouter.get(
      '/user/emails/confirm-secondary',
      AuthenticationController.requireLogin(),
      PermissionsController.requirePermission('add-secondary-email'),
      UserEmailsController.confirmSecondaryEmailPage
    )
  }

  webRouter.get(
    '/user/sessions',
    AuthenticationController.requireLogin(),
    UserPagesController.sessionsPage
  )
  webRouter.post(
    '/user/sessions/clear',
    AuthenticationController.requireLogin(),
    UserController.clearSessions
  )

  // deprecated
  webRouter.delete(
    '/user/newsletter/unsubscribe',
    AuthenticationController.requireLogin(),
    UserController.unsubscribe
  )

  webRouter.post(
    '/user/newsletter/unsubscribe',
    AuthenticationController.requireLogin(),
    UserController.unsubscribe
  )

  webRouter.post(
    '/user/newsletter/subscribe',
    AuthenticationController.requireLogin(),
    UserController.subscribe
  )

  webRouter.get(
    '/user/email-preferences',
    AuthenticationController.requireLogin(),
    UserPagesController.emailPreferencesPage
  )

  webRouter.post(
    '/user/delete',
    RateLimiterMiddleware.rateLimit(rateLimiters.deleteUser),
    AuthenticationController.requireLogin(),
    PermissionsController.requirePermission('delete-own-account'),
    UserController.tryDeleteUser
  )

  webRouter.get(
    '/user/personal_info',
    AuthenticationController.requireLogin(),
    UserInfoController.getLoggedInUsersPersonalInfo
  )
  privateApiRouter.get(
    '/user/:user_id/personal_info',
    AuthenticationController.requirePrivateApiAuth(),
    UserInfoController.getPersonalInfo
  )
  webRouter.get(
    '/user/features',
    AuthenticationController.requireLogin(),
    UserInfoController.getUserFeatures
  )

  webRouter.get(
    '/user/reconfirm',
    UserPagesController.renderReconfirmAccountPage
  )
  // for /user/reconfirm POST, see password router

  webRouter.get(
    '/user/tpds/queues',
    AuthenticationController.requireLogin(),
    TpdsController.getQueues
  )

  webRouter.post(
    '/tutorial/:tutorialKey/complete',
    AuthenticationController.requireLogin(),
    TutorialController.completeTutorial
  )

  webRouter.post(
    '/tutorial/:tutorialKey/postpone',
    AuthenticationController.requireLogin(),
    TutorialController.postponeTutorial
  )

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
    RateLimiterMiddleware.rateLimit(rateLimiters.openDashboard),
    AsyncLocalStorage.middleware,
    await Modules.middleware('domainCaptureTestSession'),
    PermissionsController.useCapabilities(),
    ProjectListController.projectListPage
  )
  webRouter.post(
    '/project/new',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.createProject),
    ProjectController.newProject
  )
  webRouter.post(
    '/api/project',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.getProjects),
    ProjectListController.getProjectsJson
  )

  for (const route of [
    // Keep the old route for continuous metrics
    '/Project/:Project_id',
    // New route for pdf-detach
    '/Project/:Project_id/:detachRole(detacher|detached)',
  ]) {
    webRouter.get(
      route,
      RateLimiterMiddleware.rateLimit(openProjectRateLimiter, {
        params: ['Project_id'],
      }),
      AsyncLocalStorage.middleware,
      PermissionsController.useCapabilities(),
      AuthorizationMiddleware.ensureUserCanReadProject,
      ProjectController.loadEditor
    )
  }
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

  webRouter.get(
    '/Project/:Project_id/doc/:Doc_id/download', // "download" suffix to avoid conflict with private API route at doc/:doc_id
    AuthorizationMiddleware.ensureUserCanReadProject,
    DocumentUpdaterController.getDoc
  )
  webRouter.post(
    '/project/:Project_id/settings',
    AuthorizationMiddleware.ensureUserCanWriteProjectSettings,
    ProjectController.updateProjectSettings
  )
  webRouter.post(
    '/project/:Project_id/settings/admin',
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.ensureUserCanAdminProject,
    ProjectController.updateProjectAdminSettings
  )

  webRouter.post(
    '/project/:Project_id/compile',
    RateLimiterMiddleware.rateLimit(rateLimiters.compileProjectHttp, {
      params: ['Project_id'],
    }),
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.compile
  )

  webRouter.post(
    '/project/:Project_id/compile/stop',
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.stopCompile
  )

  webRouter.get(
    '/project/:Project_id/output/cached/output.overleaf.json',
    AuthorizationMiddleware.ensureUserCanReadProject,
    ClsiCacheController.getLatestBuildFromCache
  )

  webRouter.get(
    '/download/project/:Project_id/build/:buildId/output/cached/:filename',
    AuthorizationMiddleware.ensureUserCanReadProject,
    ClsiCacheController.downloadFromCache
  )

  // PDF Download button for specific build
  webRouter.get(
    '/download/project/:Project_id/build/:build_id/output/output.pdf',
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.downloadPdf
  )

  // Align with limits defined in CompileController.downloadPdf
  const rateLimiterMiddlewareOutputFiles = RateLimiterMiddleware.rateLimit(
    rateLimiters.miscOutputDownload,
    { params: ['Project_id'] }
  )

  // direct url access to output files for a specific build
  webRouter.get(
    /^\/project\/([^/]*)\/build\/([0-9a-f-]+)\/output\/(.*)$/,
    function (req, res, next) {
      const params = {
        Project_id: req.params[0],
        build_id: req.params[1],
        file: req.params[2],
      }
      req.params = params
      next()
    },
    rateLimiterMiddlewareOutputFiles,
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.getFileFromClsi
  )

  // direct url access to output files for a specific user and build
  webRouter.get(
    /^\/project\/([^/]*)\/user\/([0-9a-f]+)\/build\/([0-9a-f-]+)\/output\/(.*)$/,
    function (req, res, next) {
      const params = {
        Project_id: req.params[0],
        user_id: req.params[1],
        build_id: req.params[2],
        file: req.params[3],
      }
      req.params = params
      next()
    },
    rateLimiterMiddlewareOutputFiles,
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

  webRouter.post(
    '/Project/:Project_id/archive',
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.ensureUserCanReadProject,
    ProjectController.archiveProject
  )
  webRouter.delete(
    '/Project/:Project_id/archive',
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.ensureUserCanReadProject,
    ProjectController.unarchiveProject
  )
  webRouter.post(
    '/project/:project_id/trash',
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.ensureUserCanReadProject,
    ProjectController.trashProject
  )
  webRouter.delete(
    '/project/:project_id/trash',
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.ensureUserCanReadProject,
    ProjectController.untrashProject
  )

  webRouter.delete(
    '/Project/:Project_id',
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.ensureUserCanAdminProject,
    ProjectController.deleteProject
  )

  webRouter.post(
    '/Project/:Project_id/restore',
    AuthenticationController.requireLogin(),
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
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.ensureUserCanAdminProject,
    ProjectController.renameProject
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
    RateLimiterMiddleware.rateLimit(rateLimiters.zipDownload, {
      params: ['Project_id'],
    }),
    AuthorizationMiddleware.ensureUserCanReadProject,
    ProjectDownloadsController.downloadProject
  )
  webRouter.get(
    '/project/download/zip',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.multipleProjectsZipDownload),
    AuthorizationMiddleware.ensureUserCanReadMultipleProjects,
    ProjectDownloadsController.downloadMultipleProjects
  )

  webRouter.get(
    '/project/:project_id/metadata',
    AuthorizationMiddleware.ensureUserCanReadProject,
    Settings.allowAnonymousReadAndWriteSharing
      ? (req, res, next) => {
          next()
        }
      : AuthenticationController.requireLogin(),
    MetaController.getMetadata
  )
  webRouter.post(
    '/project/:project_id/doc/:doc_id/metadata',
    AuthorizationMiddleware.ensureUserCanReadProject,
    Settings.allowAnonymousReadAndWriteSharing
      ? (req, res, next) => {
          next()
        }
      : AuthenticationController.requireLogin(),
    MetaController.broadcastMetadataForDoc
  )
  privateApiRouter.post(
    '/internal/expire-deleted-projects-after-duration',
    AuthenticationController.requirePrivateApiAuth(),
    ProjectController.expireDeletedProjectsAfterDuration
  )
  privateApiRouter.post(
    '/internal/expire-deleted-users-after-duration',
    AuthenticationController.requirePrivateApiAuth(),
    UserController.expireDeletedUsersAfterDuration
  )
  privateApiRouter.post(
    '/internal/project/:projectId/expire-deleted-project',
    AuthenticationController.requirePrivateApiAuth(),
    ProjectController.expireDeletedProject
  )
  privateApiRouter.post(
    '/internal/users/:userId/expire',
    AuthenticationController.requirePrivateApiAuth(),
    UserController.expireDeletedUser
  )

  privateApiRouter.get(
    '/user/:userId/tag',
    AuthenticationController.requirePrivateApiAuth(),
    TagsController.apiGetAllTags
  )
  webRouter.get(
    '/tag',
    AuthenticationController.requireLogin(),
    TagsController.getAllTags
  )
  webRouter.post(
    '/tag',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.createTag),
    TagsController.createTag
  )
  webRouter.post(
    '/tag/:tagId/rename',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.renameTag),
    TagsController.renameTag
  )
  webRouter.post(
    '/tag/:tagId/edit',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.renameTag),
    TagsController.editTag
  )
  webRouter.delete(
    '/tag/:tagId',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.deleteTag),
    TagsController.deleteTag
  )
  webRouter.post(
    '/tag/:tagId/project/:projectId',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.addProjectToTag),
    TagsController.addProjectToTag
  )
  webRouter.post(
    '/tag/:tagId/projects',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.addProjectsToTag),
    TagsController.addProjectsToTag
  )
  webRouter.delete(
    '/tag/:tagId/project/:projectId',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.removeProjectFromTag),
    TagsController.removeProjectFromTag
  )
  webRouter.post(
    '/tag/:tagId/projects/remove',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.removeProjectsFromTag),
    TagsController.removeProjectsFromTag
  )

  webRouter.get(
    '/notifications',
    AuthenticationController.requireLogin(),
    NotificationsController.getAllUnreadNotifications
  )
  webRouter.delete(
    '/notifications/:notificationId',
    AuthenticationController.requireLogin(),
    NotificationsController.markNotificationAsRead
  )

  webRouter.get(
    '/user/notification/:notificationId',
    AuthenticationController.requireLogin(),
    NotificationsController.getNotification
  )

  // Deprecated in favour of /internal/project/:project_id but still used by versioning
  privateApiRouter.get(
    '/project/:project_id/details',
    AuthenticationController.requirePrivateApiAuth(),
    ProjectApiController.getProjectDetails
  )

  // New 'stable' /internal API end points
  privateApiRouter.get(
    '/internal/project/:project_id',
    AuthenticationController.requirePrivateApiAuth(),
    ProjectApiController.getProjectDetails
  )
  privateApiRouter.get(
    '/internal/project/:Project_id/zip',
    AuthenticationController.requirePrivateApiAuth(),
    ProjectDownloadsController.downloadProject
  )
  privateApiRouter.get(
    '/internal/project/:project_id/compile/pdf',
    AuthenticationController.requirePrivateApiAuth(),
    CompileController.compileAndDownloadPdf
  )

  privateApiRouter.post(
    '/internal/deactivateOldProjects',
    AuthenticationController.requirePrivateApiAuth(),
    InactiveProjectController.deactivateOldProjects
  )
  privateApiRouter.post(
    '/internal/project/:project_id/deactivate',
    AuthenticationController.requirePrivateApiAuth(),
    InactiveProjectController.deactivateProject
  )

  privateApiRouter.get(
    '/project/:Project_id/doc/:doc_id',
    AuthenticationController.requirePrivateApiAuth(),
    DocumentController.getDocument
  )
  privateApiRouter.post(
    '/project/:Project_id/doc/:doc_id',
    AuthenticationController.requirePrivateApiAuth(),
    DocumentController.setDocument
  )

  privateApiRouter.post(
    '/user/:user_id/project/new',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.createProject
  )
  privateApiRouter.post(
    '/tpds/folder-update',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.updateFolder
  )
  privateApiRouter.post(
    '/user/:user_id/update/*',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.mergeUpdate
  )
  privateApiRouter.delete(
    '/user/:user_id/update/*',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.deleteUpdate
  )
  privateApiRouter.post(
    '/project/:project_id/user/:user_id/update/*',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.mergeUpdate
  )
  privateApiRouter.delete(
    '/project/:project_id/user/:user_id/update/*',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.deleteUpdate
  )

  privateApiRouter.post(
    '/project/:project_id/contents/*',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.updateProjectContents
  )
  privateApiRouter.delete(
    '/project/:project_id/contents/*',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.deleteProjectContents
  )

  webRouter.post(
    '/spelling/learn',
    AuthenticationController.requireLogin(),
    SpellingController.learn
  )

  webRouter.post(
    '/spelling/unlearn',
    AuthenticationController.requireLogin(),
    SpellingController.unlearn
  )

  if (Features.hasFeature('chat')) {
    webRouter.get(
      '/project/:project_id/messages',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      PermissionsController.requirePermission('chat'),
      ChatController.getMessages
    )
    webRouter.post(
      '/project/:project_id/messages',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      PermissionsController.requirePermission('chat'),
      RateLimiterMiddleware.rateLimit(rateLimiters.sendChatMessage),
      ChatController.sendMessage
    )
    webRouter.delete(
      '/project/:project_id/messages/:message_id',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      PermissionsController.requirePermission('chat'),
      ChatController.deleteMessage
    )
    webRouter.post(
      '/project/:project_id/messages/:message_id/edit',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      PermissionsController.requirePermission('chat'),
      ChatController.editMessage
    )
  }

  webRouter.post(
    '/project/:Project_id/references/indexAll',
    AuthorizationMiddleware.ensureUserCanReadProject,
    RateLimiterMiddleware.rateLimit(rateLimiters.indexAllProjectReferences),
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

  webRouter.get('/chrome', function (req, res, next) {
    // Match v1 behaviour - this is used for a Chrome web app
    if (SessionManager.isUserLoggedIn(req.session)) {
      res.redirect('/project')
    } else {
      res.redirect('/register')
    }
  })

  webRouter.get(
    '/admin',
    AuthorizationMiddleware.ensureUserIsSiteAdmin,
    AdminController.index
  )

  if (!Features.hasFeature('saas')) {
    webRouter.post(
      '/admin/openEditor',
      AuthorizationMiddleware.ensureUserIsSiteAdmin,
      AdminController.openEditor
    )
    webRouter.post(
      '/admin/closeEditor',
      AuthorizationMiddleware.ensureUserIsSiteAdmin,
      AdminController.closeEditor
    )
    webRouter.post(
      '/admin/disconnectAllUsers',
      AuthorizationMiddleware.ensureUserIsSiteAdmin,
      AdminController.disconnectAllUsers
    )
  }
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

  privateApiRouter.get('/perfTest', (req, res) => {
    plainTextResponse(res, 'hello')
  })

  publicApiRouter.get('/status', (req, res) => {
    if (Settings.shuttingDown) {
      res.sendStatus(503) // Service unavailable
    } else if (!Settings.siteIsOpen) {
      plainTextResponse(res, 'web site is closed (web)')
    } else if (!Settings.editorIsOpen) {
      plainTextResponse(res, 'web editor is closed (web)')
    } else {
      plainTextResponse(res, 'web is alive (web)')
    }
  })
  privateApiRouter.get('/status', (req, res) => {
    plainTextResponse(res, 'web is alive (api)')
  })

  // used by kubernetes health-check and acceptance tests
  webRouter.get('/dev/csrf', (req, res) => {
    plainTextResponse(res, res.locals.csrfToken)
  })

  publicApiRouter.get(
    '/health_check',
    HealthCheckController.checkActiveHandles,
    HealthCheckController.check
  )
  privateApiRouter.get(
    '/health_check',
    HealthCheckController.checkActiveHandles,
    HealthCheckController.checkApi
  )
  publicApiRouter.get(
    '/health_check/api',
    HealthCheckController.checkActiveHandles,
    HealthCheckController.checkApi
  )
  privateApiRouter.get(
    '/health_check/api',
    HealthCheckController.checkActiveHandles,
    HealthCheckController.checkApi
  )
  publicApiRouter.get(
    '/health_check/full',
    HealthCheckController.checkActiveHandles,
    HealthCheckController.check
  )
  privateApiRouter.get(
    '/health_check/full',
    HealthCheckController.checkActiveHandles,
    HealthCheckController.check
  )

  publicApiRouter.get('/health_check/redis', HealthCheckController.checkRedis)
  privateApiRouter.get('/health_check/redis', HealthCheckController.checkRedis)

  publicApiRouter.get('/health_check/mongo', HealthCheckController.checkMongo)
  privateApiRouter.get('/health_check/mongo', HealthCheckController.checkMongo)

  webRouter.get(
    '/status/compiler/:Project_id',
    RateLimiterMiddleware.rateLimit(rateLimiters.statusCompiler),
    AuthorizationMiddleware.ensureUserCanReadProject,
    function (req, res) {
      const projectId = req.params.Project_id
      // use a valid user id for testing
      const testUserId = '123456789012345678901234'
      const sendRes = _.once(function (statusCode, message, clsiServerId) {
        res.status(statusCode)
        plainTextResponse(res, message)
        // Force every compile to a new server and do not leave cruft behind.
        CompileManager.promises
          .deleteAuxFiles(projectId, testUserId, clsiServerId)
          .catch(() => {})
      })
      let handler = setTimeout(function () {
        CompileManager.promises
          .stopCompile(projectId, testUserId)
          .catch(() => {})
        sendRes(500, 'Compiler timed out')
        handler = null
      }, 10000)
      CompileManager.compile(
        projectId,
        testUserId,
        { metricsPath: 'health-check' },
        function (error, status, _outputFiles, clsiServerId) {
          if (handler) {
            clearTimeout(handler)
          }
          if (error) {
            sendRes(
              500,
              `Compiler returned error ${error.message}`,
              clsiServerId
            )
          } else if (status === 'success') {
            sendRes(
              200,
              'Compiler returned in less than 10 seconds',
              clsiServerId
            )
          } else {
            sendRes(500, `Compiler returned failure ${status}`, clsiServerId)
          }
        }
      )
    }
  )

  webRouter.post('/error/client', function (req, res, next) {
    logger.warn(
      { err: req.body.error, meta: req.body.meta },
      'client side error'
    )
    metrics.inc('client-side-error')
    res.sendStatus(204)
  })

  if (Features.hasFeature('link-sharing')) {
    webRouter.get(
      `/read/:token(${TokenAccessController.READ_ONLY_TOKEN_PATTERN})`,
      RateLimiterMiddleware.rateLimit(rateLimiters.readOnlyToken),
      AnalyticsRegistrationSourceMiddleware.setSource(
        'collaboration',
        'link-sharing'
      ),
      TokenAccessController.tokenAccessPage,
      AnalyticsRegistrationSourceMiddleware.clearSource()
    )

    webRouter.get(
      `/:token(${TokenAccessController.READ_AND_WRITE_TOKEN_PATTERN})`,
      RateLimiterMiddleware.rateLimit(rateLimiters.readAndWriteToken),
      AnalyticsRegistrationSourceMiddleware.setSource(
        'collaboration',
        'link-sharing'
      ),
      TokenAccessController.tokenAccessPage,
      AnalyticsRegistrationSourceMiddleware.clearSource()
    )

    webRouter.post(
      `/:token(${TokenAccessController.READ_AND_WRITE_TOKEN_PATTERN})/grant`,
      RateLimiterMiddleware.rateLimit(rateLimiters.grantTokenAccessReadWrite),
      TokenAccessController.grantTokenAccessReadAndWrite
    )

    webRouter.post(
      `/read/:token(${TokenAccessController.READ_ONLY_TOKEN_PATTERN})/grant`,
      RateLimiterMiddleware.rateLimit(rateLimiters.grantTokenAccessReadOnly),
      TokenAccessController.grantTokenAccessReadOnly
    )
  }

  webRouter.get('/unsupported-browser', renderUnsupportedBrowserPage)

  webRouter.get('*', ErrorController.notFound)
}

export default { initialize, rateLimiters }

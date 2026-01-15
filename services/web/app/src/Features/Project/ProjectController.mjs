import _ from 'lodash'
import OError from '@overleaf/o-error'
import crypto from 'node:crypto'
import { setTimeout } from 'node:timers/promises'
import pProps from 'p-props'
import logger from '@overleaf/logger'
import { expressify } from '@overleaf/promise-utils'
import mongodb from 'mongodb-legacy'
import ProjectDeleter from './ProjectDeleter.mjs'
import ProjectDuplicator from './ProjectDuplicator.mjs'
import ProjectCreationHandler from './ProjectCreationHandler.mjs'
import EditorController from '../Editor/EditorController.mjs'
import ProjectHelper from './ProjectHelper.mjs'
import metrics from '@overleaf/metrics'
import { User } from '../../models/User.mjs'
import SubscriptionLocator from '../Subscription/SubscriptionLocator.mjs'
import SubscriptionHelper from '../Subscription/SubscriptionHelper.mjs'
import LimitationsManager from '../Subscription/LimitationsManager.mjs'
import Settings from '@overleaf/settings'
import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import InactiveProjectManager from '../InactiveData/InactiveProjectManager.mjs'
import ProjectUpdateHandler from './ProjectUpdateHandler.mjs'
import ProjectGetter from './ProjectGetter.mjs'
import PrivilegeLevels from '../Authorization/PrivilegeLevels.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import Sources from '../Authorization/Sources.mjs'
import TokenAccessHandler from '../TokenAccess/TokenAccessHandler.mjs'
import CollaboratorsGetter from '../Collaborators/CollaboratorsGetter.mjs'
import ProjectEntityHandler from './ProjectEntityHandler.mjs'
import TpdsProjectFlusher from '../ThirdPartyDataStore/TpdsProjectFlusher.mjs'
import Features from '../../infrastructure/Features.mjs'
import BrandVariationsHandler from '../BrandVariations/BrandVariationsHandler.mjs'
import UserController from '../User/UserController.mjs'
import AnalyticsManager from '../Analytics/AnalyticsManager.mjs'
import LocalsHelper from '../SplitTests/LocalsHelper.mjs'
import SplitTestHandler from '../SplitTests/SplitTestHandler.mjs'
import SplitTestSessionHandler from '../SplitTests/SplitTestSessionHandler.mjs'
import FeaturesUpdater from '../Subscription/FeaturesUpdater.mjs'
import SpellingHandler from '../Spelling/SpellingHandler.mjs'
import AdminAuthorizationHelper from '../Helpers/AdminAuthorizationHelper.mjs'
import InstitutionsFeatures from '../Institutions/InstitutionsFeatures.mjs'
import InstitutionsGetter from '../Institutions/InstitutionsGetter.mjs'
import ProjectAuditLogHandler from './ProjectAuditLogHandler.mjs'
import PublicAccessLevels from '../Authorization/PublicAccessLevels.mjs'
import TagsHandler from '../Tags/TagsHandler.mjs'
import TutorialHandler from '../Tutorial/TutorialHandler.mjs'
import UserUpdater from '../User/UserUpdater.mjs'
import Modules from '../../infrastructure/Modules.mjs'
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'
import UserGetter from '../User/UserGetter.mjs'
import { isStandaloneAiAddOnPlanCode } from '../Subscription/AiHelper.mjs'
import SubscriptionController from '../Subscription/SubscriptionController.mjs'
import { formatCurrency } from '../../util/currency.js'
import UserSettingsHelper from './UserSettingsHelper.mjs'

const { isPaidSubscription } = SubscriptionHelper
const { hasAdminAccess } = AdminAuthorizationHelper
const { ObjectId } = mongodb
/**
 * @import { GetProjectsRequest, GetProjectsResponse, Project } from "./types"
 */

const updateProjectAdminSettingsSchema = z.object({
  params: z.object({
    Project_id: zz.coercedObjectId(ObjectId),
  }),
  body: z.object({
    publicAccessLevel: z
      .enum(
        [PublicAccessLevels.PRIVATE, PublicAccessLevels.TOKEN_BASED],
        'unexpected access level'
      )
      .optional(),
  }),
})

const updateProjectSettingsSchema = z.object({
  params: z.object({
    Project_id: zz.coercedObjectId(),
  }),
  body: z.object({
    compiler: z.string().optional(),
    imageName: z.string().optional(),
    mainBibliographyDocId: zz.objectId().optional(),
    name: z.string().optional(),
    rootDocId: zz.objectId().optional(),
    spellCheckLanguage: z.string().optional(),
  }),
})

const _ProjectController = {
  _isInPercentageRollout(rolloutName, objectId, percentage) {
    if (Settings.bypassPercentageRollouts === true) {
      return true
    }
    const data = `${rolloutName}:${objectId.toString()}`
    const md5hash = crypto.createHash('md5').update(data).digest('hex')
    const counter = parseInt(md5hash.slice(26, 32), 16)
    return counter % 100 < percentage
  },

  async updateProjectSettings(req, res) {
    const { params, body } = parseReq(req, updateProjectSettingsSchema)
    const projectId = params.Project_id

    if (body.compiler != null) {
      await EditorController.promises.setCompiler(projectId, body.compiler)
    }

    if (body.imageName != null) {
      await EditorController.promises.setImageName(projectId, body.imageName)
    }

    if (body.name != null) {
      await EditorController.promises.renameProject(projectId, body.name)
    }

    if (body.spellCheckLanguage != null) {
      await EditorController.promises.setSpellCheckLanguage(
        projectId,
        body.spellCheckLanguage
      )
    }

    if (body.rootDocId != null) {
      await EditorController.promises.setRootDoc(projectId, body.rootDocId)
    }

    if (body.mainBibliographyDocId != null) {
      await EditorController.promises.setMainBibliographyDoc(
        projectId,
        body.mainBibliographyDocId
      )
    }

    res.sendStatus(204)
  },

  async updateProjectAdminSettings(req, res) {
    const { params, body } = parseReq(req, updateProjectAdminSettingsSchema)
    const projectId = params.Project_id
    const user = SessionManager.getSessionUser(req.session)
    if (!Features.hasFeature('link-sharing')) {
      return res.sendStatus(403) // return Forbidden if link sharing is not enabled
    }

    if (body.publicAccessLevel != null) {
      await EditorController.promises.setPublicAccessLevel(
        projectId,
        body.publicAccessLevel
      )

      await ProjectAuditLogHandler.promises.addEntry(
        projectId,
        'toggle-access-level',
        user._id,
        req.ip,
        { publicAccessLevel: body.publicAccessLevel, status: 'OK' }
      )
      res.sendStatus(204)
    } else {
      res.sendStatus(500)
    }
  },

  async deleteProject(req, res) {
    const projectId = req.params.Project_id
    const user = SessionManager.getSessionUser(req.session)
    await ProjectDeleter.promises.deleteProject(projectId, {
      deleterUser: user,
      ipAddress: req.ip,
    })
    ProjectAuditLogHandler.addEntryIfManagedInBackground(
      projectId,
      'project-deleted',
      user._id,
      req.ip
    )
    res.sendStatus(200)
  },

  async archiveProject(req, res) {
    const projectId = req.params.Project_id
    const userId = SessionManager.getLoggedInUserId(req.session)
    await ProjectDeleter.promises.archiveProject(projectId, userId)
    ProjectAuditLogHandler.addEntryIfManagedInBackground(
      projectId,
      'project-archived',
      userId,
      req.ip
    )
    res.sendStatus(200)
  },

  async unarchiveProject(req, res) {
    const projectId = req.params.Project_id
    const userId = SessionManager.getLoggedInUserId(req.session)
    await ProjectDeleter.promises.unarchiveProject(projectId, userId)
    ProjectAuditLogHandler.addEntryIfManagedInBackground(
      projectId,
      'project-unarchived',
      userId,
      req.ip
    )
    res.sendStatus(200)
  },

  async trashProject(req, res) {
    const projectId = req.params.project_id
    const userId = SessionManager.getLoggedInUserId(req.session)
    await ProjectDeleter.promises.trashProject(projectId, userId)
    ProjectAuditLogHandler.addEntryIfManagedInBackground(
      projectId,
      'project-trashed',
      userId,
      req.ip
    )
    res.sendStatus(200)
  },

  async untrashProject(req, res) {
    const projectId = req.params.project_id
    const userId = SessionManager.getLoggedInUserId(req.session)
    await ProjectDeleter.promises.untrashProject(projectId, userId)
    ProjectAuditLogHandler.addEntryIfManagedInBackground(
      projectId,
      'project-untrashed',
      userId,
      req.ip
    )
    res.sendStatus(200)
  },

  async expireDeletedProjectsAfterDuration(_req, res) {
    await ProjectDeleter.promises.expireDeletedProjectsAfterDuration()
    res.sendStatus(200)
  },

  async expireDeletedProject(req, res) {
    const { projectId } = req.params
    await ProjectDeleter.promises.expireDeletedProject(projectId)
    res.sendStatus(200)
  },

  async restoreProject(req, res) {
    const user = SessionManager.getLoggedInUserId(req.session)
    const projectId = req.params.Project_id
    await ProjectDeleter.promises.restoreProject(projectId)
    ProjectAuditLogHandler.addEntryIfManagedInBackground(
      projectId,
      'project-restored',
      user._id,
      req.ip
    )
    res.sendStatus(200)
  },

  async cloneProject(req, res, next) {
    res.setTimeout(5 * 60 * 1000) // allow extra time for the copy to complete
    metrics.inc('cloned-project')
    const projectId = req.params.Project_id
    const { projectName, tags } = req.body
    logger.debug({ projectId, projectName }, 'cloning project')
    if (!SessionManager.isUserLoggedIn(req.session)) {
      return res.json({ redir: '/register' })
    }
    const currentUser = SessionManager.getSessionUser(req.session)
    const { first_name: firstName, last_name: lastName, email } = currentUser
    try {
      const project = await ProjectDuplicator.promises.duplicate(
        currentUser,
        projectId,
        projectName,
        tags
      )
      ProjectAuditLogHandler.addEntryIfManagedInBackground(
        projectId,
        'project-cloned',
        currentUser._id,
        req.ip
      )
      res.json({
        name: project.name,
        lastUpdated: project.lastUpdated,
        project_id: project._id,
        owner_ref: project.owner_ref,
        owner: {
          first_name: firstName,
          last_name: lastName,
          email,
          _id: currentUser._id,
        },
      })
    } catch (err) {
      OError.tag(err, 'error cloning project', {
        projectId,
        userId: currentUser._id,
      })
      return next(err)
    }
  },

  async newProject(req, res) {
    const currentUser = SessionManager.getSessionUser(req.session)
    const {
      first_name: firstName,
      last_name: lastName,
      email,
      _id: userId,
    } = currentUser
    const projectName =
      req.body.projectName != null ? req.body.projectName.trim() : undefined
    const { template } = req.body

    const project = await (template === 'example'
      ? ProjectCreationHandler.promises.createExampleProject(
          userId,
          projectName
        )
      : ProjectCreationHandler.promises.createBasicProject(userId, projectName))

    ProjectAuditLogHandler.addEntryIfManagedInBackground(
      project._id,
      'project-created',
      project.owner_ref,
      req.ip
    )

    res.json({
      project_id: project._id,
      owner_ref: project.owner_ref,
      owner: {
        first_name: firstName,
        last_name: lastName,
        email,
        _id: userId,
      },
    })
  },

  async renameProject(req, res) {
    const projectId = req.params.Project_id
    const newName = req.body.newProjectName
    await EditorController.promises.renameProject(projectId, newName)
    res.sendStatus(200)
  },

  async userProjectsJson(req, res) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    let projects = await ProjectGetter.promises.findAllUsersProjects(
      userId,
      'name lastUpdated publicAccesLevel archived trashed owner_ref'
    )

    // _buildProjectList already converts archived/trashed to booleans so isArchivedOrTrashed should not be used here
    projects = ProjectController._buildProjectList(projects, userId)
      .filter(p => !(p.archived || p.trashed))
      .map(p => ({ _id: p.id, name: p.name, accessLevel: p.accessLevel }))

    res.json({ projects })
  },

  async projectEntitiesJson(req, res) {
    const projectId = req.params.Project_id
    const project = await ProjectGetter.promises.getProject(projectId)

    const { docs, files } =
      ProjectEntityHandler.getAllEntitiesFromProject(project)
    const entities = docs
      .concat(files)
      // Sort by path ascending
      .sort((a, b) => (a.path > b.path ? 1 : a.path < b.path ? -1 : 0))
      .map(e => ({
        path: e.path,
        type: e.doc != null ? 'doc' : 'file',
      }))
    res.json({ project_id: projectId, entities })
  },

  async loadEditor(req, res, next) {
    const timer = new metrics.Timer('load-editor')
    if (!Settings.editorIsOpen) {
      return res.render('general/closed', { title: 'updating_site' })
    }

    let anonymous, userId, sessionUser
    if (SessionManager.isUserLoggedIn(req.session)) {
      sessionUser = SessionManager.getSessionUser(req.session)
      userId = SessionManager.getLoggedInUserId(req.session)
      anonymous = false
    } else {
      sessionUser = null
      anonymous = true
      userId = null
    }

    if (Features.hasFeature('saas') && userId) {
      const { variant: domainCaptureRedirect } =
        await SplitTestHandler.promises.getAssignment(
          req,
          res,
          'domain-capture-redirect'
        )

      if (domainCaptureRedirect === 'enabled') {
        const subscription = (
          await Modules.promises.hooks.fire(
            'findDomainCaptureGroupUserCouldBePartOf',
            userId
          )
        )?.[0]

        if (subscription) {
          if (subscription.managedUsersEnabled) {
            return res.redirect('/domain-capture')
          } else {
            // TODO show notification or anything else
          }
        }
      }
    }

    const projectId = req.params.Project_id

    // should not be used in place of split tests query param overrides (?my-split-test-name=my-variant)
    function shouldDisplayFeature(name, variantFlag) {
      if (req.query && req.query[name]) {
        return req.query[name] === 'true'
      } else {
        return variantFlag === true
      }
    }

    const splitTests = [
      'bibtex-visual-editor',
      'compile-log-events',
      'visual-preview',
      'external-socket-heartbeat',
      'null-test-share-modal',
      'pdf-caching-prefetch-large',
      'pdf-caching-prefetching',
      'revert-file',
      'revert-project',
      !anonymous && 'ro-mirror-on-client',
      'track-pdf-download',
      !anonymous && 'writefull-oauth-promotion',
      'hotjar',
      'overleaf-assist-bundle',
      'word-count-client',
      'editor-popup-ux-survey',
      'editor-redesign-new-users',
      'writefull-frontend-migration',
      'chat-edit-delete',
      'ai-workbench',
      'compile-timeout-target-plans',
      'writefull-keywords-generator',
      'writefull-figure-generator',
      'wf-citations-checker',
      'wf-citations-checker-on-selection',
      'writefull-asymetric-queue-size-per-model',
      'writefull-encourage-prompt-for-paraphrase',
      'editor-context-menu',
      'email-notifications',
      'editor-redesign-no-opt-out',
    ].filter(Boolean)

    const getUserValues = async userId =>
      pProps(
        _.mapValues({
          user: (async () => {
            const user = await User.findById(
              userId,
              'email first_name last_name referal_id signUpDate featureSwitches features featuresEpoch refProviders alphaProgram betaProgram isAdmin ace labsProgram labsExperiments completedTutorials writefull aiErrorAssistant'
            ).exec()
            // Handle case of deleted user
            if (!user) {
              UserController.logout(req, res, next)
              return
            }
            logger.debug({ projectId, userId }, 'got user')
            return FeaturesUpdater.featuresEpochIsCurrent(user)
              ? user
              : await ProjectController._refreshFeatures(req, user)
          })(),
          learnedWords: SpellingHandler.promises.getUserDictionary(userId),
          projectTags: TagsHandler.promises.getTagsForProject(
            userId,
            projectId
          ),
          userHasInstitutionLicence: InstitutionsFeatures.promises
            .hasLicence(userId)
            .catch(err => {
              logger.error({ err, userId }, 'failed to get institution licence')
              return false
            }),
          affiliations: InstitutionsGetter.promises
            .getCurrentAffiliations(userId)
            .catch(err => {
              logger.error(
                { err, userId },
                'failed to get current affiliations'
              )
              return false
            }),
          subscription:
            SubscriptionLocator.promises.getUsersSubscription(userId),
          isTokenMember: CollaboratorsGetter.promises.userIsTokenMember(
            userId,
            projectId
          ),
          isInvitedMember:
            CollaboratorsGetter.promises.isUserInvitedMemberOfProject(
              userId,
              projectId
            ),
        })
      )

    try {
      const responses = await pProps({
        userValues: userId ? getUserValues(userId) : defaultUserValues(),
        project: ProjectGetter.promises.getProject(projectId, {
          name: 1,
          lastUpdated: 1,
          track_changes: 1,
          owner_ref: 1,
          brandVariationId: 1,
          overleaf: 1,
          tokens: 1,
          tokenAccessReadAndWrite_refs: 1, // used for link sharing analytics
          collaberator_refs: 1, // used for link sharing analytics
          pendingEditor_refs: 1, // used for link sharing analytics
          reviewer_refs: 1,
        }),
        userIsMemberOfGroupSubscription: sessionUser
          ? (async () =>
              (
                await LimitationsManager.promises.userIsMemberOfGroupSubscription(
                  sessionUser
                )
              ).isMember)()
          : false,
        _flushToTpds:
          TpdsProjectFlusher.promises.flushProjectToTpdsIfNeeded(projectId),
        _activate:
          InactiveProjectManager.promises.reactivateProjectIfRequired(
            projectId
          ),
      })

      const { project, userValues, userIsMemberOfGroupSubscription } = responses

      const {
        user,
        learnedWords,
        projectTags,
        userHasInstitutionLicence,
        subscription,
        isTokenMember,
        isInvitedMember,
        affiliations,
      } = userValues

      let inEnterpriseCommons = false
      for (const affiliation of affiliations || []) {
        inEnterpriseCommons =
          inEnterpriseCommons || affiliation.institution?.enterpriseCommons
      }

      const getSplitTestAssignment = async splitTest => {
        return await SplitTestHandler.promises.getAssignment(
          req,
          res,
          splitTest
        )
      }
      const splitTestAssignments = {}
      await Promise.all(
        splitTests.map(async splitTest => {
          splitTestAssignments[splitTest] =
            await getSplitTestAssignment(splitTest)
        })
      )

      // PDF caching, these tests are archived but we are keeping the frontend code unchanged for now
      LocalsHelper.setSplitTestVariant(
        res.locals,
        'pdf-caching-cached-url-lookup',
        Settings.cachedUrlLookupEnabled ? 'enabled' : 'disabled'
      )
      LocalsHelper.setSplitTestVariant(
        res.locals,
        'pdf-caching-mode',
        Settings.pdfCachingMode ? 'enabled' : 'disabled'
      )

      const brandVariation = project?.brandVariationId
        ? await BrandVariationsHandler.promises.getBrandVariationById(
            project.brandVariationId
          )
        : undefined

      const anonRequestToken = TokenAccessHandler.getRequestToken(
        req,
        projectId
      )
      const imageNames = ProjectHelper.getAllowedImagesForUser(user)

      const privilegeLevel =
        await AuthorizationManager.promises.getPrivilegeLevelForProject(
          userId,
          projectId,
          anonRequestToken
        )

      await Modules.promises.hooks.fire('enforceCollaboratorLimit', projectId)
      if (isTokenMember) {
        // Check explicitly that the user is in read write token refs, while this could be inferred
        // from the privilege level, the privilege level of token members might later be restricted
        const isReadWriteTokenMember =
          await CollaboratorsGetter.promises.userIsReadWriteTokenMember(
            userId,
            projectId
          )
        if (isReadWriteTokenMember) {
          // Check for an edge case where a user is both in read write token access refs but also
          // an invited read write member. Ensure they are not redirected to the sharing updates page
          // We could also delete the token access ref if the user is already a member of the project
          const isInvitedReadWriteMember =
            await CollaboratorsGetter.promises.isUserInvitedReadWriteMemberOfProject(
              userId,
              projectId
            )
          if (!isInvitedReadWriteMember) {
            return res.redirect(`/project/${projectId}/sharing-updates`)
          }
        }
      }

      if (privilegeLevel == null || privilegeLevel === PrivilegeLevels.NONE) {
        return res.sendStatus(401)
      }

      const allowedFreeTrial =
        subscription == null ||
        isStandaloneAiAddOnPlanCode(subscription.planCode)

      let wsUrl = Settings.wsUrl
      let metricName = 'load-editor-ws'
      if (user.betaProgram && Settings.wsUrlBeta !== undefined) {
        wsUrl = Settings.wsUrlBeta
        metricName += '-beta'
      } else if (
        Settings.wsUrlV2 &&
        Settings.wsUrlV2Percentage > 0 &&
        (new ObjectId(projectId).getTimestamp() / 1000) % 100 <
          Settings.wsUrlV2Percentage
      ) {
        wsUrl = Settings.wsUrlV2
        metricName += '-v2'
      }
      if (req.query && req.query.ws === 'fallback') {
        // `?ws=fallback` will connect to the bare origin, and ignore
        //   the custom wsUrl. Hence it must load the client side
        //   javascript from there too.
        // Not resetting it here would possibly load a socket.io v2
        //  client and connect to a v0 endpoint.
        wsUrl = undefined
        metricName += '-fallback'
      }
      metrics.inc(metricName)

      // don't need to wait for these to complete
      ProjectUpdateHandler.promises
        .markAsOpened(projectId)
        .catch(err =>
          logger.error({ err, projectId }, 'failed to mark project as opened')
        )
      SplitTestSessionHandler.promises
        .sessionMaintenance(req, userId ? user : null)
        .catch(err =>
          logger.error({ err }, 'failed to update split test info in session')
        )

      const ownerFeatures = await UserGetter.promises.getUserFeatures(
        project.owner_ref
      )
      if (userId) {
        const planLimit = ownerFeatures?.collaborators || 0
        const namedEditors = project.collaberator_refs?.length || 0
        const pendingEditors = project.pendingEditor_refs?.length || 0
        const exceedAtLimit = planLimit > -1 && namedEditors >= planLimit

        let mode = 'edit'
        if (privilegeLevel === PrivilegeLevels.READ_ONLY) {
          mode = 'view'
        } else if (
          project.track_changes === true ||
          project.track_changes?.[userId] === true
        ) {
          mode = 'review'
        }

        const projectOpenedSegmentation = {
          role: privilegeLevel,
          mode,
          ownerId: project.owner_ref,
          projectId: project._id,
          namedEditors,
          pendingEditors,
          tokenEditors: project.tokenAccessReadAndWrite_refs?.length || 0,
          planLimit,
          exceedAtLimit,
        }
        AnalyticsManager.recordEventForUserInBackground(
          userId,
          'project-opened',
          projectOpenedSegmentation
        )
        User.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { lastActive: new Date() } }
        )
          .exec()
          .catch(err =>
            logger.error(
              { err, userId },
              'failed to update lastActive for user'
            )
          )
      }

      const isAdminOrTemplateOwner =
        hasAdminAccess(user) || Settings.templates?.user_id === userId
      const showTemplatesServerPro =
        Features.hasFeature('templates-server-pro') && isAdminOrTemplateOwner

      const debugPdfDetach = shouldDisplayFeature('debug_pdf_detach')

      const detachRole = req.params.detachRole

      const showSymbolPalette =
        !Features.hasFeature('saas') ||
        (user.features && user.features.symbolPalette)

      const userInNonIndividualSub =
        userIsMemberOfGroupSubscription || userHasInstitutionLicence

      const userHasPremiumSub =
        subscription && !isStandaloneAiAddOnPlanCode(subscription.planCode)

      // Persistent upgrade prompts
      // in header & in share project modal
      const showUpgradePrompt =
        Features.hasFeature('saas') &&
        userId &&
        !userHasPremiumSub &&
        !userInNonIndividualSub

      let aiFeaturesAllowed = false
      if (userId && Features.hasFeature('saas')) {
        try {
          // exit early if the user couldnt use ai anyways, since permissions checks are expensive
          const canUserWriteOrReviewProjectContent =
            privilegeLevel === PrivilegeLevels.READ_AND_WRITE ||
            privilegeLevel === PrivilegeLevels.OWNER ||
            privilegeLevel === PrivilegeLevels.REVIEW

          if (canUserWriteOrReviewProjectContent) {
            // check permissions for user and project owner, to see if they allow AI on the project
            const permissionsResults = await Modules.promises.hooks.fire(
              'projectAllowsCapability',
              project,
              userId,
              ['use-ai']
            )
            const aiAllowed = permissionsResults.every(
              result => result === true
            )

            aiFeaturesAllowed = aiAllowed
          }
        } catch (err) {
          // still allow users to access project if we cant get their permissions, but disable AI feature
          aiFeaturesAllowed = false
        }
      }

      let featureUsage = {}

      if (Features.hasFeature('saas')) {
        const usagesLeft = await Modules.promises.hooks.fire(
          'remainingFeatureAllocation',
          userId
        )
        usagesLeft?.forEach(usage => {
          featureUsage = { ...featureUsage, ...usage }
        })
      }

      await ProjectController._setWritefullTrialState(
        user,
        userValues,
        userId,
        aiFeaturesAllowed,
        userIsMemberOfGroupSubscription
      )

      const template =
        detachRole === 'detached'
          ? 'project/ide-react-detached'
          : 'project/ide-react'

      const capabilities = [...req.capabilitySet]

      // make sure the capability is added to CE/SP when the feature is enabled
      if (!Features.hasFeature('saas') && Features.hasFeature('chat')) {
        capabilities.push('chat')
      }

      // Note: this is not part of the default capabilities in the backend.
      // See services/web/modules/group-settings/app/src/DefaultGroupPolicy.mjs.
      // We are only using it on the frontend at the moment.
      // Add !Features.hasFeature('saas') to the conditional, as for chat above
      // if you define the capability in the backend.
      if (Features.hasFeature('link-sharing')) {
        capabilities.push('link-sharing')
      }

      const isOverleafAssistBundleEnabled =
        splitTestAssignments['overleaf-assist-bundle']?.variant === 'enabled'

      let fullFeatureSet = user?.features
      if (!anonymous) {
        fullFeatureSet = await UserGetter.promises.getUserFeatures(userId)
      }

      const hasPaidSubscription = isPaidSubscription(subscription)
      const hasManuallyCollectedSubscription =
        subscription?.collectionMethod === 'manual'
      const assistantDisabled = user.aiErrorAssistant?.enabled === false // the assistant has been manually disabled by the user
      const canUseErrorAssistant =
        (!hasManuallyCollectedSubscription ||
          fullFeatureSet?.aiErrorAssistant) &&
        !assistantDisabled

      const customerIoEnabled =
        await SplitTestHandler.promises.hasUserBeenAssignedToVariant(
          req,
          userId,
          'customer-io-trial-conversion',
          'enabled',
          true
        )

      const addonPrices =
        isOverleafAssistBundleEnabled &&
        (await ProjectController._getAddonPrices(req, res))

      let standardPlanPricing
      let recommendedCurrency
      if (Features.hasFeature('saas')) {
        standardPlanPricing = await ProjectController._getPlanPricing(
          req,
          res,
          'collaborator'
        )
        const { currency } =
          await SubscriptionController.getRecommendedCurrency(req, res)
        recommendedCurrency = currency
      }

      let planCode = subscription?.planCode
      if (!planCode && !userInNonIndividualSub) {
        planCode = 'personal'
      }

      const planDetails = Settings.plans.find(p => p.planCode === planCode)

      const shouldLoadHotjar =
        splitTestAssignments['compile-timeout-target-plans']?.variant ===
          'enabled' &&
        !userHasPremiumSub &&
        !userInNonIndividualSub

      const userSettings = await UserSettingsHelper.buildUserSettings(
        req,
        res,
        user
      )

      res.render(template, {
        title: project.name,
        priority_title: true,
        bodyClasses: ['editor'],
        project_id: project._id,
        projectName: project.name,
        canUseClsiCache:
          Features.hasFeature('saas') &&
          ownerFeatures?.compileGroup === 'priority',
        user: {
          id: userId,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          referal_id: user.referal_id,
          signUpDate: user.signUpDate,
          allowedFreeTrial,
          hasPaidSubscription,
          featureSwitches: user.featureSwitches,
          features: fullFeatureSet,
          featureUsage,
          refProviders: _.mapValues(user.refProviders, Boolean),
          writefull: {
            enabled: Boolean(user.writefull?.enabled && aiFeaturesAllowed),
            autoCreatedAccount: Boolean(user.writefull?.autoCreatedAccount),
            firstAutoLoad: Boolean(user.writefull?.firstAutoLoad),
          },
          alphaProgram: user.alphaProgram,
          betaProgram: user.betaProgram,
          labsProgram: user.labsProgram,
          inactiveTutorials: TutorialHandler.getInactiveTutorials(user),
          isAdmin: hasAdminAccess(user),
          planCode,
          planName: planDetails?.name,
          isAnnualPlan: planCode && planDetails?.annual,
          isMemberOfGroupSubscription: userIsMemberOfGroupSubscription,
          hasInstitutionLicence: userHasInstitutionLicence,
        },
        userSettings,
        labsExperiments: user.labsExperiments ?? [],
        privilegeLevel,
        anonymous,
        isTokenMember,
        isRestrictedTokenMember: AuthorizationManager.isRestrictedUser(
          userId,
          privilegeLevel,
          isTokenMember,
          isInvitedMember
        ),
        capabilities,
        roMirrorOnClientNoLocalStorage:
          Settings.adminOnlyLogin || project.name.startsWith('Debug: '),
        languages: Settings.languages,
        learnedWords,
        editorThemes: THEME_LIST,
        legacyEditorThemes: LEGACY_THEME_LIST,
        maxDocLength: Settings.max_doc_length,
        maxReconnectGracefullyIntervalMs:
          Settings.maxReconnectGracefullyIntervalMs,
        brandVariation,
        imageNames,
        gitBridgePublicBaseUrl: Settings.gitBridgePublicBaseUrl,
        gitBridgeEnabled: Features.hasFeature('git-bridge'),
        wsUrl,
        showSupport: Features.hasFeature('support'),
        showTemplatesServerPro,
        debugPdfDetach,
        showSymbolPalette,
        symbolPaletteAvailable: Features.hasFeature('symbol-palette'),
        userRestrictions: Array.from(req.userRestrictions || []),
        showAiErrorAssistant: aiFeaturesAllowed && canUseErrorAssistant,
        detachRole,
        metadata: { viewport: false },
        showUpgradePrompt,
        fixedSizeDocument: true,
        hasTrackChangesFeature: Features.hasFeature('track-changes'),
        otMigrationStage: project.overleaf?.history?.otMigrationStage ?? 0,
        projectTags,
        isSaas: Features.hasFeature('saas'),
        shouldLoadHotjar,
        isOverleafAssistBundleEnabled,
        customerIoEnabled,
        addonPrices,
        compileSettings: {
          compileTimeout: ownerFeatures?.compileTimeout,
        },
        standardPlanPricing,
        recommendedCurrency,
      })
      timer.done()
    } catch (err) {
      OError.tag(err, 'error getting details for project page')
      return next(err)
    }
  },

  async _getPlanPricing(req, res, plan = 'collaborator') {
    const locale = req.i18n.language
    const { currency } = await SubscriptionController.getRecommendedCurrency(
      req,
      res
    )

    const pricingForCurrency = Settings.localizedPlanPricing[currency]
    if (!pricingForCurrency) {
      return null
    }

    const planPricing = pricingForCurrency[plan]
    if (!planPricing) {
      return null
    }

    return {
      monthly: formatCurrency(planPricing.monthly, currency, locale, true),
      annual: formatCurrency(planPricing.annual, currency, locale, true),
      monthlyTimesTwelve: formatCurrency(
        planPricing.monthlyTimesTwelve,
        currency,
        locale,
        true
      ),
    }
  },

  async _getAddonPrices(req, res, addonPlans = ['assistant']) {
    const plansData = {}

    const locale = req.i18n.language
    const { currency } = await SubscriptionController.getRecommendedCurrency(
      req,
      res
    )

    addonPlans.forEach(plan => {
      const annualPrice = Settings.localizedAddOnsPricing[currency][plan].annual
      const monthlyPrice =
        Settings.localizedAddOnsPricing[currency][plan].monthly
      const annualDividedByTwelve =
        Settings.localizedAddOnsPricing[currency][plan].annualDividedByTwelve

      plansData[plan] = {
        annual: formatCurrency(annualPrice, currency, locale, true),
        annualDividedByTwelve: formatCurrency(
          annualDividedByTwelve,
          currency,
          locale,
          true
        ),
        monthly: formatCurrency(monthlyPrice, currency, locale, true),
      }
    })
    return plansData
  },

  async _refreshFeatures(req, user) {
    // If the feature refresh has failed in this session, don't retry
    // it - require the user to log in again.
    if (req.session.feature_refresh_failed) {
      metrics.inc('features-refresh', 1, {
        path: 'load-editor',
        status: 'skipped',
      })
      return user
    }
    // If the refresh takes too long then return the current
    // features. Note that the user.features property may still be
    // updated in the background after the promise is resolved.
    const abortController = new AbortController()
    const refreshTimeoutHandler = async () => {
      await setTimeout(5000, { signal: abortController.signal })
      req.session.feature_refresh_failed = {
        reason: 'timeout',
        at: new Date(),
      }
      metrics.inc('features-refresh', 1, {
        path: 'load-editor',
        status: 'timeout',
      })
      return user
    }

    // try to refresh user features now
    const timer = new metrics.Timer('features-refresh-on-load-editor')

    return Promise.race([
      refreshTimeoutHandler(),
      (async () => {
        try {
          user.features = await FeaturesUpdater.promises.refreshFeatures(
            user._id,
            'load-editor'
          )
          metrics.inc('features-refresh', 1, {
            path: 'load-editor',
            status: 'success',
          })
        } catch (err) {
          // keep a record to prevent unneceary retries and leave
          // the original features unmodified if the refresh failed
          req.session.feature_refresh_failed = {
            reason: 'error',
            at: new Date(),
          }
          metrics.inc('features-refresh', 1, {
            path: 'load-editor',
            status: 'error',
          })
        }
        abortController.abort()
        timer.done()
        return user
      })(),
    ])
  },
  _buildProjectList(allProjects, userId) {
    let project
    const {
      owned,
      review,
      readAndWrite,
      readOnly,
      tokenReadAndWrite,
      tokenReadOnly,
    } = allProjects
    const projects = []
    for (project of owned) {
      projects.push(
        ProjectController._buildProjectViewModel(
          project,
          'owner',
          Sources.OWNER,
          userId
        )
      )
    }
    // Invite-access
    for (project of readAndWrite) {
      projects.push(
        ProjectController._buildProjectViewModel(
          project,
          'readWrite',
          Sources.INVITE,
          userId
        )
      )
    }
    for (project of review) {
      projects.push(
        ProjectController._buildProjectViewModel(
          project,
          'review',
          Sources.INVITE,
          userId
        )
      )
    }
    for (project of readOnly) {
      projects.push(
        ProjectController._buildProjectViewModel(
          project,
          'readOnly',
          Sources.INVITE,
          userId
        )
      )
    }
    // Token-access
    //   Only add these projects if they're not already present, this gives us cascading access
    //   from 'owner' => 'token-read-only'
    for (project of tokenReadAndWrite) {
      if (
        projects.filter(p => p.id.toString() === project._id.toString())
          .length === 0
      ) {
        projects.push(
          ProjectController._buildProjectViewModel(
            project,
            'readAndWrite',
            Sources.TOKEN,
            userId
          )
        )
      }
    }
    for (project of tokenReadOnly) {
      if (
        projects.filter(p => p.id.toString() === project._id.toString())
          .length === 0
      ) {
        projects.push(
          ProjectController._buildProjectViewModel(
            project,
            'readOnly',
            Sources.TOKEN,
            userId
          )
        )
      }
    }

    return projects
  },
  _buildProjectViewModel(project, accessLevel, source, userId) {
    const archived = ProjectHelper.isArchived(project, userId)
    // If a project is simultaneously trashed and archived, we will consider it archived but not trashed.
    const trashed = ProjectHelper.isTrashed(project, userId) && !archived

    const model = {
      id: project._id,
      name: project.name,
      lastUpdated: project.lastUpdated,
      lastUpdatedBy: project.lastUpdatedBy,
      publicAccessLevel: project.publicAccesLevel,
      accessLevel,
      source,
      archived,
      trashed,
      owner_ref: project.owner_ref,
      isV1Project: false,
    }
    if (accessLevel === PrivilegeLevels.READ_ONLY && source === Sources.TOKEN) {
      model.owner_ref = null
      model.lastUpdatedBy = null
    }
    return model
  },
  _buildPortalTemplatesList(affiliations) {
    if (affiliations == null) {
      affiliations = []
    }
    const portalTemplates = []
    for (const aff of affiliations) {
      if (
        aff.portal &&
        aff.portal.slug &&
        aff.portal.templates_count &&
        aff.portal.templates_count > 0
      ) {
        const portalPath = aff.institution.isUniversity ? '/edu/' : '/org/'
        portalTemplates.push({
          name: aff.institution.name,
          url: Settings.siteUrl + portalPath + aff.portal.slug,
        })
      }
    }
    return portalTemplates
  },

  async _setWritefullTrialState(
    user,
    userValues,
    userId,
    aiFeaturesAllowed,
    userIsMemberOfGroupSubscription
  ) {
    const affiliations = userValues.affiliations
    const affiliateLookupFailed = affiliations === false

    // if affiliations is specifically false instead of empty, we know the affiliate lookup failed, and should defer to blocking auto-loading
    const inEnterpriseCommons =
      affiliateLookupFailed ||
      affiliations.some(
        affiliation => affiliation.institution?.enterpriseCommons
      )

    // check if a user has never tried writefull before (writefull.enabled will be null)
    //  if they previously accepted writefull, or are have been already assigned to a trial, user.writefull will be true,
    //  if they explicitly disabled it, user.writefull will be false
    const shouldPushWritefull =
      aiFeaturesAllowed &&
      user.writefull?.enabled === null &&
      !userIsMemberOfGroupSubscription

    // we dont have legal approval to push enterprise commons into WF auto-account-create, but we are able to auto-load it into the toolbar
    const shouldAutoCreateAccount = shouldPushWritefull && !inEnterpriseCommons
    const shouldAutoLoad = shouldPushWritefull && inEnterpriseCommons

    if (shouldAutoCreateAccount) {
      await UserUpdater.promises.updateUser(userId, {
        $set: {
          writefull: { enabled: true, autoCreatedAccount: true },
        },
      })
      user.writefull.enabled = true
      user.writefull.autoCreatedAccount = true
    } else if (shouldAutoLoad) {
      await UserUpdater.promises.updateUser(userId, {
        $set: {
          writefull: { enabled: true, autoCreatedAccount: false },
        },
      })
      user.writefull.enabled = true
      user.writefull.autoCreatedAccount = false
    }
  },
}

const defaultSettingsForAnonymousUser = userId => ({
  id: userId,
  ace: {
    mode: 'none',
    theme: 'textmate',
    fontSize: '12',
    autoComplete: true,
    spellCheckLanguage: '',
    pdfViewer: '',
    syntaxValidation: true,
  },
  subscription: {
    freeTrial: {
      allowed: true,
    },
  },
  featureSwitches: {
    github: false,
  },
  alphaProgram: false,
  betaProgram: false,
  writefull: {
    enabled: false,
  },
})

const defaultUserValues = () => ({
  user: defaultSettingsForAnonymousUser(null),
  learnedWords: [],
  projectTags: [],
  userHasInstitutionLicence: false,
  affiliations: [],
  subscription: undefined,
  isTokenMember: false,
  isInvitedMember: false,
})

const THEME_LIST = [
  { name: 'cobalt', dark: true },
  { name: 'dracula', dark: true },
  { name: 'eclipse', dark: false },
  { name: 'monokai', dark: true },
  { name: 'overleaf', dark: false },
  { name: 'overleaf_dark', dark: true },
  { name: 'textmate', dark: false },
]

const LEGACY_THEME_LIST = [
  { name: 'ambiance', dark: true },
  { name: 'chaos', dark: true },
  { name: 'chrome', dark: false },
  { name: 'clouds', dark: false },
  { name: 'clouds_midnight', dark: true },
  { name: 'crimson_editor', dark: false },
  { name: 'dawn', dark: false },
  { name: 'dreamweaver', dark: false },
  { name: 'github', dark: false },
  { name: 'gob', dark: true },
  { name: 'gruvbox', dark: true },
  { name: 'idle_fingers', dark: true },
  { name: 'iplastic', dark: false },
  { name: 'katzenmilch', dark: false },
  { name: 'kr_theme', dark: true },
  { name: 'kuroir', dark: false },
  { name: 'merbivore', dark: true },
  { name: 'merbivore_soft', dark: true },
  { name: 'mono_industrial', dark: true },
  { name: 'nord_dark', dark: true },
  { name: 'pastel_on_dark', dark: true },
  { name: 'solarized_dark', dark: true },
  { name: 'solarized_light', dark: false },
  { name: 'sqlserver', dark: false },
  { name: 'terminal', dark: true },
  { name: 'tomorrow', dark: false },
  { name: 'tomorrow_night', dark: true },
  { name: 'tomorrow_night_blue', dark: true },
  { name: 'tomorrow_night_bright', dark: true },
  { name: 'tomorrow_night_eighties', dark: true },
  { name: 'twilight', dark: true },
  { name: 'vibrant_ink', dark: true },
  { name: 'xcode', dark: false },
]

const ProjectController = {
  archiveProject: expressify(_ProjectController.archiveProject),
  cloneProject: expressify(_ProjectController.cloneProject),
  deleteProject: expressify(_ProjectController.deleteProject),
  expireDeletedProject: expressify(_ProjectController.expireDeletedProject),
  expireDeletedProjectsAfterDuration: expressify(
    _ProjectController.expireDeletedProjectsAfterDuration
  ),
  loadEditor: expressify(_ProjectController.loadEditor),
  newProject: expressify(_ProjectController.newProject),
  projectEntitiesJson: expressify(_ProjectController.projectEntitiesJson),
  renameProject: expressify(_ProjectController.renameProject),
  restoreProject: expressify(_ProjectController.restoreProject),
  trashProject: expressify(_ProjectController.trashProject),
  unarchiveProject: expressify(_ProjectController.unarchiveProject),
  untrashProject: expressify(_ProjectController.untrashProject),
  updateProjectAdminSettings: expressify(
    _ProjectController.updateProjectAdminSettings
  ),
  updateProjectSettings: expressify(_ProjectController.updateProjectSettings),
  userProjectsJson: expressify(_ProjectController.userProjectsJson),
  _buildProjectList: _ProjectController._buildProjectList,
  _buildProjectViewModel: _ProjectController._buildProjectViewModel,
  _injectProjectUsers: _ProjectController._injectProjectUsers,
  _isInPercentageRollout: _ProjectController._isInPercentageRollout,
  _refreshFeatures: _ProjectController._refreshFeatures,
  _getPlanPricing: _ProjectController._getPlanPricing,
  _getAddonPrices: _ProjectController._getAddonPrices,
  _setWritefullTrialState: _ProjectController._setWritefullTrialState,
}

export default ProjectController

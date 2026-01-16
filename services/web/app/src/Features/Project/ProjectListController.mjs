// @ts-check
import _ from 'lodash'
import moment from 'moment'

import Metrics from '@overleaf/metrics'
import Settings from '@overleaf/settings'
import ProjectHelper from './ProjectHelper.mjs'
import ProjectGetter from './ProjectGetter.mjs'
import PrivilegeLevels from '../Authorization/PrivilegeLevels.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import Sources from '../Authorization/Sources.mjs'
import UserGetter from '../User/UserGetter.mjs'
import SurveyHandler from '../Survey/SurveyHandler.mjs'
import TagsHandler from '../Tags/TagsHandler.mjs'
import { expressify } from '@overleaf/promise-utils'
import logger from '@overleaf/logger'
import Features from '../../infrastructure/Features.mjs'
import SubscriptionViewModelBuilder from '../Subscription/SubscriptionViewModelBuilder.mjs'
import NotificationsHandler from '../Notifications/NotificationsHandler.mjs'
import Modules from '../../infrastructure/Modules.mjs'
import { OError, V1ConnectionError } from '../Errors/Errors.js'
import { User } from '../../models/User.mjs'
import UserPrimaryEmailCheckHandler from '../User/UserPrimaryEmailCheckHandler.mjs'
import UserController from '../User/UserController.mjs'
import NotificationsBuilder from '../Notifications/NotificationsBuilder.mjs'
import GeoIpLookup from '../../infrastructure/GeoIpLookup.mjs'
import SplitTestHandler from '../SplitTests/SplitTestHandler.mjs'
import SplitTestSessionHandler from '../SplitTests/SplitTestSessionHandler.mjs'
import TutorialHandler from '../Tutorial/TutorialHandler.mjs'
import SubscriptionHelper from '../Subscription/SubscriptionHelper.mjs'
import PermissionsManager from '../Authorization/PermissionsManager.mjs'
import AnalyticsManager from '../Analytics/AnalyticsManager.mjs'
import { OnboardingDataCollection } from '../../models/OnboardingDataCollection.mjs'
import UserSettingsHelper from './UserSettingsHelper.mjs'

/**
 * @import { GetProjectsRequest, GetProjectsResponse, AllUsersProjects, MongoProject, FormattedProject, MongoTag } from "./types"
 * @import { Project, ProjectApi, ProjectAccessLevel, Filters, Page, Sort, UserRef } from "../../../../types/project/dashboard/api"
 * @import { Affiliation } from "../../../../types/affiliation"
 * @import { Source } from "../Authorization/types"
 */

/**
 * @param {Affiliation} affiliation
 * @param session
 * @param linkedInstitutionIds
 * @returns {boolean}
 * @private
 */
const _ssoAvailable = (affiliation, session, linkedInstitutionIds) => {
  if (!affiliation.institution) return false

  // institution.confirmed is for the domain being confirmed, not the email
  // Do not show SSO UI for unconfirmed domains
  if (!affiliation.institution.confirmed) return false

  // If ssoEnabled = true and group.domainCaptureEnabled = true
  // then Commons is migrating to group subscription and we do not want to prompt
  // linking through Commons SSO
  if (affiliation?.group?.domainCaptureEnabled) return false

  // Could have multiple emails at the same institution, and if any are
  // linked to the institution then do not show notification for others
  if (
    linkedInstitutionIds.indexOf(affiliation.institution.id.toString()) === -1
  ) {
    if (affiliation.institution.ssoEnabled) return true
    if (affiliation.institution.ssoBeta && session.samlBeta) return true
    return false
  }
  return false
}

/**
 * @param {Affiliation[]} affiliations
 * @returns {Array<{ name: string, url: string }>}
 */
const _buildPortalTemplatesList = affiliations => {
  if (affiliations == null) {
    affiliations = []
  }

  const portalTemplates = []
  const uniqueAffiliations = _.uniqBy(affiliations, 'institution.id')
  for (const aff of uniqueAffiliations) {
    const hasSlug = aff.portal?.slug
    const hasTemplates = (aff.portal?.templates_count || 0) > 0

    if (hasSlug && hasTemplates) {
      const portalPath = aff.institution.isUniversity ? '/edu/' : '/org/'
      const portalTemplateURL = Settings.siteUrl + portalPath + aff.portal?.slug

      portalTemplates.push({
        name: aff.institution.name,
        url: portalTemplateURL,
      })
    }
  }
  return portalTemplates
}

function cleanupSession(req) {
  // cleanup redirects at the end of the redirect chain
  delete req.session.postCheckoutRedirect
  delete req.session.postLoginRedirect
  delete req.session.postOnboardingRedirect

  // cleanup details from register page
  delete req.session.sharedProjectData
  delete req.session.templateData
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>}
 */
async function projectListPage(req, res, next) {
  cleanupSession(req)

  // can have two values:
  // - undefined - when there's no "saas" feature or couldn't get subscription data
  // - object - the subscription data object
  let usersBestSubscription
  let usersIndividualSubscription
  let usersGroupSubscriptions = []
  let usersManagedGroupSubscriptions = []
  let survey
  let userIsMemberOfGroupSubscription = false
  let groupSubscriptionsPendingEnrollment = []

  const isSaas = Features.hasFeature('saas')

  const userId = SessionManager.getLoggedInUserId(req.session)

  if (isSaas) {
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

  const projectsBlobPending = _getProjects(userId).catch(err => {
    logger.err({ err, userId }, 'projects listing in background failed')
    return undefined
  })
  const user = await User.findById(
    userId,
    `email emails features alphaProgram betaProgram lastPrimaryEmailCheck lastActive signUpDate ace refProviders${
      isSaas ? ' enrollment writefull completedTutorials aiErrorAssistant' : ''
    }`
  )

  // Handle case of deleted user
  if (user == null) {
    UserController.logout(req, res, next)
    return
  }

  user.refProviders = _.mapValues(user.refProviders, Boolean)

  if (isSaas) {
    await SplitTestSessionHandler.promises.sessionMaintenance(req, user)

    try {
      ;({
        bestSubscription: usersBestSubscription,
        individualSubscription: usersIndividualSubscription,
        memberGroupSubscriptions: usersGroupSubscriptions,
        managedGroupSubscriptions: usersManagedGroupSubscriptions,
      } = await SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
        { _id: userId }
      ))
    } catch (error) {
      logger.err(
        { err: error, userId },
        "Failed to get user's best subscription"
      )
    }

    userIsMemberOfGroupSubscription =
      usersGroupSubscriptions.length > 0 ||
      usersManagedGroupSubscriptions.length > 0

    // TODO use helper function
    if (!user.enrollment?.managedBy) {
      groupSubscriptionsPendingEnrollment = usersGroupSubscriptions.filter(
        subscription =>
          subscription.groupPlan && subscription.managedUsersEnabled
      )
    }

    try {
      survey = await SurveyHandler.promises.getSurvey(userId)
    } catch (error) {
      logger.err({ err: error, userId }, 'Failed to load the active survey')
    }

    if (
      user &&
      UserPrimaryEmailCheckHandler.requiresPrimaryEmailCheck({
        email: user.email,
        emails: user.emails,
        lastPrimaryEmailCheck: user.lastPrimaryEmailCheck,
        signUpDate: user.signUpDate,
      })
    ) {
      return res.redirect('/user/emails/primary-email-check')
    }
  }

  const tags = await TagsHandler.promises.getAllTags(userId)

  /** @type {{ list: any[], allInReconfirmNotificationPeriods?: any[], error?: any }} */
  let userEmailsData = {
    list: [],
  }

  try {
    const fullEmails = await UserGetter.promises.getUserFullEmails(userId)

    if (!Features.hasFeature('affiliations')) {
      userEmailsData.list = fullEmails
    } else {
      try {
        const results = await Modules.promises.hooks.fire(
          'allInReconfirmNotificationPeriodsForUser',
          fullEmails
        )

        const allInReconfirmNotificationPeriods = (results && results[0]) || []

        userEmailsData = {
          list: fullEmails,
          allInReconfirmNotificationPeriods,
        }
      } catch (error) {
        userEmailsData.error = error
      }
    }
  } catch (error) {
    if (!(error instanceof V1ConnectionError)) {
      logger.error({ err: error, userId }, 'Failed to get user full emails')
    }
  }

  const userEmails = userEmailsData.list || []

  const userAffiliations = userEmails
    .filter(emailData => !!emailData.affiliation)
    .map(emailData => {
      const result = emailData.affiliation
      result.email = emailData.email
      return result
    })

  const portalTemplates = _buildPortalTemplatesList(userAffiliations)

  const { allInReconfirmNotificationPeriods } = userEmailsData

  const notifications =
    await NotificationsHandler.promises.getUserNotifications(userId)

  for (const notification of notifications) {
    notification.html = req.i18n.translate(
      notification.templateKey,
      notification.messageOpts
    )
  }

  const notificationsInstitution = []
  // Institution and group SSO Notifications
  let groupSsoSetupSuccess
  let viaDomainCapture
  let joinedGroupName = ''
  let reconfirmedViaSAML
  if (Features.hasFeature('saml')) {
    reconfirmedViaSAML = _.get(req.session, ['saml', 'reconfirmed'])
    const samlSession = req.session.saml
    // Notification: SSO Available
    const linkedInstitutionIds = []
    userEmails.forEach(email => {
      if (email.samlProviderId) {
        linkedInstitutionIds.push(email.samlProviderId)
      }
    })
    if (Array.isArray(userAffiliations)) {
      userAffiliations.forEach(affiliation => {
        if (_ssoAvailable(affiliation, req.session, linkedInstitutionIds)) {
          notificationsInstitution.push({
            email: affiliation.email,
            institutionId: affiliation.institution.id,
            institutionName: affiliation.institution.name,
            templateKey: 'notification_institution_sso_available',
          })
        }
      })
    }

    if (samlSession) {
      // Notification institution SSO: After SSO Linked
      if (samlSession.linked) {
        let templateKey = 'notification_institution_sso_linked'

        if (
          samlSession.userCreatedViaDomainCapture &&
          samlSession.managedUsersEnabled
        ) {
          templateKey =
            'notification_account_created_via_group_domain_capture_and_managed_users_enabled'
        } else if (samlSession.domainCaptureEnabled) {
          templateKey = 'notification_group_sso_linked'
        }
        notificationsInstitution.push({
          email: samlSession.institutionEmail,
          institutionName:
            samlSession.linked.universityName ||
            samlSession.linked.providerName,
          templateKey,
        })
      }

      // Notification group SSO: After SSO Linked
      if (samlSession.linkedGroup) {
        groupSsoSetupSuccess = true
        viaDomainCapture = samlSession.domainCaptureJoin
        joinedGroupName = samlSession.universityName
      }

      // Notification institution SSO: After SSO Linked or Logging in
      // The requested email does not match primary email returned from
      // the institution
      if (
        samlSession.requestedEmail &&
        samlSession.emailNonCanonical &&
        !samlSession.error
      ) {
        notificationsInstitution.push({
          institutionEmail: samlSession.emailNonCanonical,
          requestedEmail: samlSession.requestedEmail,
          templateKey: 'notification_institution_sso_non_canonical',
        })
      }

      // Notification institution SSO: Tried to register, but account already existed
      // registerIntercept is set before the institution callback.
      // institutionEmail is set after institution callback.
      // Check for both in case SSO flow was abandoned
      if (
        samlSession.registerIntercept &&
        samlSession.institutionEmail &&
        !samlSession.error
      ) {
        notificationsInstitution.push({
          email: samlSession.institutionEmail,
          templateKey: 'notification_institution_sso_already_registered',
        })
      }

      // Notification: When there is a session error
      if (samlSession.error) {
        notificationsInstitution.push({
          templateKey: 'notification_institution_sso_error',
          error: samlSession.error,
        })
      }
    }
    delete req.session.saml
  }

  const prefetchedProjectsBlob = await projectsBlobPending
  Metrics.inc('project-list-prefetch-projects', 1, {
    status: prefetchedProjectsBlob ? 'success' : 'error',
  })

  // in v2 add notifications for matching university IPs
  if (Settings.overleaf != null && req.ip !== user.lastLoginIp) {
    try {
      await NotificationsBuilder.promises
        .ipMatcherAffiliation(user._id.toString())
        .create(req.ip)
    } catch (err) {
      logger.error(
        { err },
        'failed to create institutional IP match notification'
      )
    }
  }

  const hasPaidAffiliation = userAffiliations.some(
    affiliation => affiliation.licence && affiliation.licence !== 'free'
  )

  const inactiveTutorials = TutorialHandler.getInactiveTutorials(user)

  const usGovBannerHooksResponse = await Modules.promises.hooks.fire(
    'getUSGovBanner',
    userEmails,
    hasPaidAffiliation,
    inactiveTutorials
  )

  const usGovBanner = (usGovBannerHooksResponse &&
    usGovBannerHooksResponse[0]) || {
    showUSGovBanner: false,
    usGovBannerVariant: null,
  }

  const { showUSGovBanner, usGovBannerVariant } = usGovBanner

  const isUser30DaysOld = moment.utc().diff(user.signUpDate, 'days') > 30

  const showGroupsAndEnterpriseBanner =
    Features.hasFeature('saas') &&
    !showUSGovBanner &&
    !userIsMemberOfGroupSubscription &&
    !hasPaidAffiliation &&
    !inactiveTutorials.includes('groups-enterprise-banner-repeat') &&
    isUser30DaysOld

  const groupsAndEnterpriseBannerVariant =
    showGroupsAndEnterpriseBanner &&
    _.sample(['on-premise', 'FOMO', 'FOMO', 'FOMO'])

  let showInrGeoBanner = false
  let showLATAMBanner = false
  let recommendedCurrency
  const { countryCode, currencyCode } =
    await GeoIpLookup.promises.getCurrencyCode(req.ip)

  if (
    usersBestSubscription?.type === 'free' ||
    usersBestSubscription?.type === 'standalone-ai-add-on'
  ) {
    if (countryCode === 'IN') {
      showInrGeoBanner = true
    }

    showLATAMBanner = ['MX', 'CO', 'CL', 'PE'].includes(countryCode)
    // LATAM Banner needs to know which currency to display
    if (showLATAMBanner) {
      recommendedCurrency = currencyCode
    }
  }

  let hasIndividualPaidSubscription = false

  try {
    hasIndividualPaidSubscription =
      SubscriptionHelper.isIndividualActivePaidSubscription(
        usersIndividualSubscription
      )
  } catch (error) {
    logger.error({ err: error }, 'Failed to get individual subscription')
  }

  const affiliations = userAffiliations || []
  const commonsInstitution = affiliations.find(
    affiliation => affiliation.institution?.commonsAccount
  )?.institution?.name

  let onboardingDataCollection
  let subjectArea
  let usedLatex
  let primaryOccupation
  let role

  // customer.io: Premium nudge experiment
  // Only do customer-io-trial-conversion assignment for users not in India/China and not in group/commons
  let customerIoEnabled = false
  const aiBlocked = !(await _canUseAIAssist(user))
  const hasAiAssist = await _userHasAIAssist(user)

  if (!userIsMemberOfGroupSubscription && !commonsInstitution && isSaas) {
    try {
      const excludedCountries = ['IN', 'CN']

      if (!excludedCountries.includes(countryCode)) {
        const cioAssignment =
          await SplitTestHandler.promises.getAssignmentForUser(
            userId,
            'customer-io-trial-conversion'
          )
        if (cioAssignment.variant === 'enabled') {
          customerIoEnabled = true
          onboardingDataCollection = await OnboardingDataCollection.findById(
            userId,
            'subjectArea usedLatex primaryOccupation role'
          )

          if (onboardingDataCollection) {
            subjectArea = onboardingDataCollection.subjectArea
            usedLatex = onboardingDataCollection.usedLatex
            primaryOccupation = onboardingDataCollection.primaryOccupation
            role = onboardingDataCollection.role
          }

          AnalyticsManager.setUserPropertyForUserInBackground(
            userId,
            'customer-io-integration',
            true
          )
        }
      }
    } catch (err) {
      logger.error(
        { err },
        'Error checking geo location for customer-io-trial-conversion'
      )
      // Fallback to not enabled if geoip fails
      customerIoEnabled = false
    }
  }

  await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'themed-project-dashboard'
  )

  const userSettings = await UserSettingsHelper.buildUserSettings(
    req,
    res,
    user
  )

  const groupRole = userIsMemberOfGroupSubscription
    ? usersManagedGroupSubscriptions?.length > 0 ||
      usersGroupSubscriptions.some(sub => sub.userIsGroupManager)
      ? 'admin'
      : 'member'
    : undefined

  res.render('project/list-react', {
    title: 'your_projects',
    usersBestSubscription,
    notifications,
    notificationsInstitution,
    user,
    userAffiliations,
    userEmails,
    userSettings,
    reconfirmedViaSAML,
    allInReconfirmNotificationPeriods,
    survey,
    tags,
    portalTemplates,
    prefetchedProjectsBlob,
    showGroupsAndEnterpriseBanner,
    groupsAndEnterpriseBannerVariant,
    showUSGovBanner,
    usGovBannerVariant,
    showLATAMBanner,
    recommendedCurrency,
    showInrGeoBanner,
    projectDashboardReact: true, // used in navbar
    groupSsoSetupSuccess,
    joinedGroupName,
    viaDomainCapture,
    groupSubscriptionsPendingEnrollment:
      groupSubscriptionsPendingEnrollment.map(subscription => ({
        groupId: subscription._id,
        groupName: subscription.teamName,
      })),
    hasIndividualPaidSubscription,
    userRestrictions: Array.from(req.userRestrictions || []),
    customerIoEnabled,
    aiBlocked,
    hasAiAssist,
    lastActive: user.lastActive
      ? Math.floor(user.lastActive.getTime() / 1000)
      : null,
    signUpDate: user.signUpDate
      ? Math.floor(user.signUpDate.getTime() / 1000)
      : null,
    subjectArea,
    primaryOccupation,
    role,
    usedLatex,
    inactiveTutorials,
    countryCode,
    commonsInstitution,
    groupRole,
    isManagedUser: Boolean(user.enrollment?.managedBy),
  })
}

/**
 * Load user's projects with pagination, sorting and filters
 *
 * @param {GetProjectsRequest} req the request
 * @param {GetProjectsResponse} res the response
 * @returns {Promise<void>}
 */
async function getProjectsJson(req, res) {
  const { filters, page, sort } = req.body
  const userId = SessionManager.getLoggedInUserId(req.session)
  const projectsPage = await _getProjects(userId, filters, sort, page)
  res.json(projectsPage)
}

/**
 * @param {string} userId
 * @param {Filters} filters
 * @param {Sort} sort
 * @param {Page} page
 * @returns {Promise<{totalSize: number, projects: Project[]}>}
 * @private
 */
async function _getProjects(
  userId,
  filters = {},
  sort = { by: 'lastUpdated', order: 'desc' },
  page = { size: 20 }
) {
  /** @type {[AllUsersProjects, MongoTag[]]} */
  const results = await Promise.all([
    ProjectGetter.promises.findAllUsersProjects(
      userId,
      'name lastUpdated lastUpdatedBy publicAccesLevel archived trashed owner_ref tokens'
    ),
    TagsHandler.promises.getAllTags(userId),
  ])
  const [allProjects, tags] = results
  const formattedProjects = _formatProjects(allProjects, userId)
  const filteredProjects = _applyFilters(
    formattedProjects,
    tags,
    filters,
    userId
  )
  const pagedProjects = _sortAndPaginate(filteredProjects, sort, page)

  const projects = await _injectProjectUsers(pagedProjects)

  return {
    totalSize: filteredProjects.length,
    projects,
  }
}

/**
 * @param {AllUsersProjects} projects
 * @param {string} userId
 * @returns {FormattedProject[]}
 * @private
 */
function _formatProjects(projects, userId) {
  const {
    owned,
    review,
    readAndWrite,
    readOnly,
    tokenReadAndWrite,
    tokenReadOnly,
  } = projects

  const formattedProjects = /** @type {FormattedProject[]} **/ []
  for (const project of owned) {
    formattedProjects.push(
      _formatProjectInfo(project, 'owner', Sources.OWNER, userId)
    )
  }
  // Invite-access
  for (const project of readAndWrite) {
    formattedProjects.push(
      _formatProjectInfo(project, 'readWrite', Sources.INVITE, userId)
    )
  }
  for (const project of review) {
    formattedProjects.push(
      _formatProjectInfo(project, 'review', Sources.INVITE, userId)
    )
  }
  for (const project of readOnly) {
    formattedProjects.push(
      _formatProjectInfo(project, 'readOnly', Sources.INVITE, userId)
    )
  }
  // Token-access
  // Only add these formattedProjects if they're not already present, this gives us cascading access
  // from 'owner' => 'token-read-only'
  for (const project of tokenReadAndWrite) {
    if (!formattedProjects.some(p => p.id === project._id.toString())) {
      formattedProjects.push(
        _formatProjectInfo(project, 'readAndWrite', Sources.TOKEN, userId)
      )
    }
  }
  for (const project of tokenReadOnly) {
    if (!formattedProjects.some(p => p.id === project._id.toString())) {
      formattedProjects.push(
        _formatProjectInfo(project, 'readOnly', Sources.TOKEN, userId)
      )
    }
  }

  return formattedProjects
}

/**
 * @param {FormattedProject[]} projects
 * @param {MongoTag[]} tags
 * @param {Filters} filters
 * @param {string} userId
 * @returns {FormattedProject[]}
 * @private
 */
function _applyFilters(projects, tags, filters, userId) {
  if (!_hasActiveFilter(filters)) {
    return projects
  }
  return projects.filter(project => _matchesFilters(project, tags, filters))
}

/**
 * @param {FormattedProject[]} projects
 * @param {Sort} sort
 * @param {Page} page
 * @returns {FormattedProject[]}
 * @private
 */
function _sortAndPaginate(projects, sort, page) {
  if (
    (sort.by && !['lastUpdated', 'title', 'owner'].includes(sort.by)) ||
    (sort.order && !['asc', 'desc'].includes(sort.order))
  ) {
    throw new OError('Invalid sorting criteria', { sort })
  }
  const sortedProjects = _.orderBy(
    projects,
    [sort.by || 'lastUpdated'],
    [sort.order || 'desc']
  )
  // TODO handle pagination
  return sortedProjects
}

/**
 * @param {MongoProject} project
 * @param {ProjectAccessLevel} accessLevel
 * @param {Source} source
 * @param {string} userId
 * @returns {FormattedProject}
 * @private
 */
function _formatProjectInfo(project, accessLevel, source, userId) {
  const archived = ProjectHelper.isArchived(project, userId)
  // If a project is simultaneously trashed and archived, we will consider it archived but not trashed.
  const trashed = ProjectHelper.isTrashed(project, userId) && !archived
  const readOnlyTokenAccess =
    accessLevel === PrivilegeLevels.READ_ONLY && source === Sources.TOKEN

  return {
    id: project._id.toString(),
    name: project.name,
    owner_ref: readOnlyTokenAccess ? null : project.owner_ref,
    lastUpdated: project.lastUpdated,
    lastUpdatedBy: readOnlyTokenAccess ? null : project.lastUpdatedBy,
    accessLevel,
    source,
    archived,
    trashed,
  }
}

/**
 * @param {FormattedProject[]} projects
 * @returns {Promise<Project[]>}
 * @private
 */
async function _injectProjectUsers(projects) {
  const userIds = new Set()
  for (const project of projects) {
    if (project.owner_ref != null) {
      userIds.add(project.owner_ref.toString())
    }
    if (project.lastUpdatedBy != null) {
      userIds.add(project.lastUpdatedBy.toString())
    }
  }

  const projection = {
    first_name: 1,
    last_name: 1,
    email: 1,
  }
  /** @type {Record<string, UserRef>} */
  const users = {}
  for (const user of await UserGetter.promises.getUsers(userIds, projection)) {
    const userId = user._id.toString()
    users[userId] = {
      id: userId,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
    }
  }

  return projects.map(project => ({
    id: project.id,
    name: project.name,
    archived: project.archived,
    trashed: project.trashed,
    accessLevel: project.accessLevel,
    source: project.source,
    lastUpdated: project.lastUpdated.toISOString(),
    lastUpdatedBy:
      project.lastUpdatedBy == null
        ? null
        : users[project.lastUpdatedBy.toString()] || null,
    owner:
      project.owner_ref == null
        ? undefined
        : users[project.owner_ref.toString()],
    owner_ref: undefined,
  }))
}

/**
 * @param {any} project
 * @param {MongoTag[]} tags
 * @param {Filters} filters
 * @private
 */
function _matchesFilters(project, tags, filters) {
  if (filters.ownedByUser && project.accessLevel !== 'owner') {
    return false
  }
  if (filters.sharedWithUser && project.accessLevel === 'owner') {
    return false
  }
  if (filters.archived && !project.archived) {
    return false
  }
  if (filters.trashed && !project.trashed) {
    return false
  }
  if (
    filters.tag &&
    !_.find(
      tags,
      tag =>
        filters.tag === tag.name && (tag.project_ids || []).includes(project.id)
    )
  ) {
    return false
  }
  if (
    filters.search?.length &&
    project.name.toLowerCase().indexOf(filters.search.toLowerCase()) === -1
  ) {
    return false
  }
  return true
}

/**
 * @param {Filters} filters
 * @returns {boolean}
 * @private
 */
function _hasActiveFilter(filters) {
  return Boolean(
    filters.ownedByUser ||
    filters.sharedWithUser ||
    filters.archived ||
    filters.trashed ||
    filters.tag === null ||
    filters.tag?.length ||
    filters.search?.length
  )
}

async function _userHasAIAssist(user) {
  // Check if the user has AI Assist enabled via Overleaf
  if (user.features?.aiErrorAssistant) {
    return true
  }
  // Check if the user has AI Assist enabled via Writefull
  const { isPremium: hasAiAssistViaWritefull } =
    await UserGetter.promises.getWritefullData(user._id)
  if (hasAiAssistViaWritefull) {
    return true
  }
  return false
}

// Determines if user is able to enable AI assist
// based on their permissions and settings
// It does NOT determine if the user has AI Assist enabled
async function _canUseAIAssist(user) {
  // Check if the assistant has been manually disabled by the user
  if (user.aiErrorAssistant?.enabled === false) {
    return false
  }

  // Check if the user can use AI features (policy check)
  return await PermissionsManager.promises.checkUserPermissions(user, [
    'use-ai',
  ])
}

export default {
  projectListPage: expressify(projectListPage),
  getProjectsJson: expressify(getProjectsJson),
}

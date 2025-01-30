// ts-check
import _ from 'lodash'

import Metrics from '@overleaf/metrics'
import Settings from '@overleaf/settings'
import ProjectHelper from './ProjectHelper.js'
import ProjectGetter from './ProjectGetter.js'
import PrivilegeLevels from '../Authorization/PrivilegeLevels.js'
import SessionManager from '../Authentication/SessionManager.js'
import Sources from '../Authorization/Sources.js'
import UserGetter from '../User/UserGetter.js'
import SurveyHandler from '../Survey/SurveyHandler.mjs'
import TagsHandler from '../Tags/TagsHandler.js'
import { expressify } from '@overleaf/promise-utils'
import logger from '@overleaf/logger'
import Features from '../../infrastructure/Features.js'
import SubscriptionViewModelBuilder from '../Subscription/SubscriptionViewModelBuilder.js'
import NotificationsHandler from '../Notifications/NotificationsHandler.js'
import Modules from '../../infrastructure/Modules.js'
import { OError, V1ConnectionError } from '../Errors/Errors.js'
import { User } from '../../models/User.js'
import UserPrimaryEmailCheckHandler from '../User/UserPrimaryEmailCheckHandler.js'
import UserController from '../User/UserController.js'
import LimitationsManager from '../Subscription/LimitationsManager.js'
import NotificationsBuilder from '../Notifications/NotificationsBuilder.js'
import GeoIpLookup from '../../infrastructure/GeoIpLookup.js'
import SplitTestHandler from '../SplitTests/SplitTestHandler.js'
import SplitTestSessionHandler from '../SplitTests/SplitTestSessionHandler.js'
import SubscriptionLocator from '../Subscription/SubscriptionLocator.js'
import TutorialHandler from '../Tutorial/TutorialHandler.js'

/**
 * @import { GetProjectsRequest, GetProjectsResponse, AllUsersProjects, MongoProject } from "./types"
 * @import { ProjectApi, Filters, Page, Sort } from "../../../../types/project/dashboard/api"
 * @import { Tag } from "../Tags/types"
 */

const _ssoAvailable = (affiliation, session, linkedInstitutionIds) => {
  if (!affiliation.institution) return false

  // institution.confirmed is for the domain being confirmed, not the email
  // Do not show SSO UI for unconfirmed domains
  if (!affiliation.institution.confirmed) return false

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

const _buildPortalTemplatesList = affiliations => {
  if (affiliations == null) {
    affiliations = []
  }

  const portalTemplates = []
  const uniqueAffiliations = _.uniqBy(affiliations, 'institution.id')
  for (const aff of uniqueAffiliations) {
    const hasSlug = aff.portal?.slug
    const hasTemplates = aff.portal?.templates_count > 0

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
  let survey
  let userIsMemberOfGroupSubscription = false
  let groupSubscriptionsPendingEnrollment = []

  const isSaas = Features.hasFeature('saas')

  const userId = SessionManager.getLoggedInUserId(req.session)
  const projectsBlobPending = _getProjects(userId).catch(err => {
    logger.err({ err, userId }, 'projects listing in background failed')
    return undefined
  })
  const user = await User.findById(
    userId,
    `email emails features alphaProgram betaProgram lastPrimaryEmailCheck signUpDate${
      isSaas ? ' enrollment writefull completedTutorials' : ''
    }`
  )

  // Handle case of deleted user
  if (user == null) {
    UserController.logout(req, res, next)
    return
  }

  if (isSaas) {
    await SplitTestSessionHandler.promises.sessionMaintenance(req, user)

    try {
      usersBestSubscription =
        await SubscriptionViewModelBuilder.promises.getBestSubscription({
          _id: userId,
        })
    } catch (error) {
      logger.err(
        { err: error, userId },
        "Failed to get user's best subscription"
      )
    }
    try {
      const { isMember, subscriptions } =
        await LimitationsManager.promises.userIsMemberOfGroupSubscription(user)

      userIsMemberOfGroupSubscription = isMember

      // TODO use helper function
      if (!user.enrollment?.managedBy) {
        groupSubscriptionsPendingEnrollment = subscriptions.filter(
          subscription =>
            subscription.groupPlan && subscription.managedUsersEnabled
        )
      }
    } catch (error) {
      logger.error(
        { err: error },
        'Failed to check whether user is a member of group subscription'
      )
    }

    try {
      survey = await SurveyHandler.promises.getSurvey(userId)
    } catch (error) {
      logger.err({ err: error, userId }, 'Failed to load the active survey')
    }

    if (user && UserPrimaryEmailCheckHandler.requiresPrimaryEmailCheck(user)) {
      return res.redirect('/user/emails/primary-email-check')
    }
  }

  const tags = await TagsHandler.promises.getAllTags(userId)

  let userEmailsData = { list: [], allInReconfirmNotificationPeriods: [] }

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
        userEmailsData = error
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
        notificationsInstitution.push({
          email: samlSession.institutionEmail,
          institutionName:
            samlSession.linked.universityName ||
            samlSession.linked.providerName,
          templateKey: 'notification_institution_sso_linked',
        })
      }

      // Notification group SSO: After SSO Linked
      if (samlSession.linkedGroup) {
        groupSsoSetupSuccess = true
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

  function fakeDelay() {
    return new Promise(resolve => {
      setTimeout(() => resolve(undefined), 0)
    })
  }

  const prefetchedProjectsBlob = await Promise.race([
    projectsBlobPending,
    fakeDelay(),
  ])
  Metrics.inc('project-list-prefetch-projects', 1, {
    status: prefetchedProjectsBlob ? 'success' : 'too-slow',
  })

  // in v2 add notifications for matching university IPs
  if (Settings.overleaf != null && req.ip !== user.lastLoginIp) {
    try {
      await NotificationsBuilder.promises
        .ipMatcherAffiliation(user._id)
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
    inactiveTutorials.includes('us-gov-banner')
  )

  const usGovBanner = (usGovBannerHooksResponse &&
    usGovBannerHooksResponse[0]) || {
    showUSGovBanner: false,
    usGovBannerVariant: null,
  }

  const { showUSGovBanner, usGovBannerVariant } = usGovBanner

  const showGroupsAndEnterpriseBanner =
    Features.hasFeature('saas') &&
    !showUSGovBanner &&
    !userIsMemberOfGroupSubscription &&
    !hasPaidAffiliation

  const groupsAndEnterpriseBannerVariant =
    showGroupsAndEnterpriseBanner &&
    _.sample(['on-premise', 'FOMO', 'FOMO', 'FOMO'])

  let showInrGeoBanner = false
  let showBrlGeoBanner = false
  let showLATAMBanner = false
  let recommendedCurrency

  if (
    usersBestSubscription?.type === 'free' ||
    usersBestSubscription?.type === 'standalone-ai-add-on'
  ) {
    const { countryCode, currencyCode } =
      await GeoIpLookup.promises.getCurrencyCode(req.ip)

    if (countryCode === 'IN') {
      showInrGeoBanner = true
    }
    showBrlGeoBanner = countryCode === 'BR'

    showLATAMBanner = ['MX', 'CO', 'CL', 'PE'].includes(countryCode)
    // LATAM Banner needs to know which currency to display
    if (showLATAMBanner) {
      recommendedCurrency = currencyCode
    }
  }

  let hasIndividualRecurlySubscription = false

  try {
    const individualSubscription =
      await SubscriptionLocator.promises.getUsersSubscription(userId)

    hasIndividualRecurlySubscription =
      individualSubscription?.groupPlan === false &&
      individualSubscription?.recurlyStatus?.state !== 'canceled' &&
      individualSubscription?.recurlySubscription_id !== ''
  } catch (error) {
    logger.error({ err: error }, 'Failed to get individual subscription')
  }

  try {
    await SplitTestHandler.promises.getAssignment(req, res, 'paywall-cta')
  } catch (error) {
    logger.error(
      { err: error },
      'failed to get "paywall-cta" split test assignment'
    )
  }

  // Get the user's assignment for the DS unified nav split test, which
  // populates splitTestVariants with a value for the split test name and allows
  // Pug to send it to the browser
  await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'sidebar-navigation-ui-update'
  )

  res.render('project/list-react', {
    title: 'your_projects',
    usersBestSubscription,
    notifications,
    notificationsInstitution,
    user,
    userAffiliations,
    userEmails,
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
    showBrlGeoBanner,
    projectDashboardReact: true, // used in navbar
    groupSsoSetupSuccess,
    groupSubscriptionsPendingEnrollment:
      groupSubscriptionsPendingEnrollment.map(subscription => ({
        groupId: subscription._id,
        groupName: subscription.teamName,
      })),
    hasIndividualRecurlySubscription,
    userRestrictions: Array.from(req.userRestrictions || []),
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
 * @returns {Promise<{totalSize: number, projects: ProjectApi[]}>}
 * @private
 */
async function _getProjects(
  userId,
  filters = {},
  sort = { by: 'lastUpdated', order: 'desc' },
  page = { size: 20 }
) {
  const [
    /** @type {AllUsersProjects} **/ allProjects,
    /** @type {Tag[]} **/ tags,
  ] = await Promise.all([
    ProjectGetter.promises.findAllUsersProjects(
      userId,
      'name lastUpdated lastUpdatedBy publicAccesLevel archived trashed owner_ref tokens'
    ),
    TagsHandler.promises.getAllTags(userId),
  ])
  const formattedProjects = _formatProjects(allProjects, userId)
  const filteredProjects = _applyFilters(
    formattedProjects,
    tags,
    filters,
    userId
  )
  const pagedProjects = _sortAndPaginate(filteredProjects, sort, page)

  await _injectProjectUsers(pagedProjects)

  return {
    totalSize: filteredProjects.length,
    projects: pagedProjects,
  }
}

/**
 * @param {AllUsersProjects} projects
 * @param {string} userId
 * @returns {Project[]}
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

  const formattedProjects = /** @type {Project[]} **/ []
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
 * @param {Project[]} projects
 * @param {Tag[]} tags
 * @param {Filters} filters
 * @param {string} userId
 * @returns {Project[]}
 * @private
 */
function _applyFilters(projects, tags, filters, userId) {
  if (!_hasActiveFilter(filters)) {
    return projects
  }
  return projects.filter(project => _matchesFilters(project, tags, filters))
}

/**
 * @param {Project[]} projects
 * @param {Sort} sort
 * @param {Page} page
 * @returns {Project[]}
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
 * @param {string} accessLevel
 * @param {'owner' | 'invite' | 'token'} source
 * @param {string} userId
 * @returns {object}
 * @private
 */
function _formatProjectInfo(project, accessLevel, source, userId) {
  const archived = ProjectHelper.isArchived(project, userId)
  // If a project is simultaneously trashed and archived, we will consider it archived but not trashed.
  const trashed = ProjectHelper.isTrashed(project, userId) && !archived

  const model = {
    id: project._id.toString(),
    name: project.name,
    owner_ref: project.owner_ref,
    lastUpdated: project.lastUpdated,
    lastUpdatedBy: project.lastUpdatedBy,
    accessLevel,
    source,
    archived,
    trashed,
  }
  if (accessLevel === PrivilegeLevels.READ_ONLY && source === Sources.TOKEN) {
    model.owner_ref = null
    model.lastUpdatedBy = null
  }
  return model
}

/**
 * @param {Project[]} projects
 * @returns {Promise<void>}
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
  for (const project of projects) {
    if (project.owner_ref != null) {
      project.owner = users[project.owner_ref.toString()]
    }
    if (project.lastUpdatedBy != null) {
      project.lastUpdatedBy = users[project.lastUpdatedBy.toString()] || null
    }

    delete project.owner_ref
  }
}

/**
 * @param {any} project
 * @param {Tag[]} tags
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
  return (
    filters.ownedByUser ||
    filters.sharedWithUser ||
    filters.archived ||
    filters.trashed ||
    filters.tag === null ||
    filters.tag?.length ||
    filters.search?.length
  )
}

export default {
  projectListPage: expressify(projectListPage),
  getProjectsJson: expressify(getProjectsJson),
}

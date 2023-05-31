const _ = require('lodash')
const Metrics = require('@overleaf/metrics')
const Settings = require('@overleaf/settings')
const ProjectHelper = require('./ProjectHelper')
const ProjectGetter = require('./ProjectGetter')
const PrivilegeLevels = require('../Authorization/PrivilegeLevels')
const SessionManager = require('../Authentication/SessionManager')
const Sources = require('../Authorization/Sources')
const UserGetter = require('../User/UserGetter')
const SurveyHandler = require('../Survey/SurveyHandler')
const TagsHandler = require('../Tags/TagsHandler')
const { expressify } = require('../../util/promises')
const logger = require('@overleaf/logger')
const Features = require('../../infrastructure/Features')
const SubscriptionViewModelBuilder = require('../Subscription/SubscriptionViewModelBuilder')
const NotificationsHandler = require('../Notifications/NotificationsHandler')
const Modules = require('../../infrastructure/Modules')
const { OError, V1ConnectionError } = require('../Errors/Errors')
const { User } = require('../../models/User')
const UserPrimaryEmailCheckHandler = require('../User/UserPrimaryEmailCheckHandler')
const UserController = require('../User/UserController')
const LimitationsManager = require('../Subscription/LimitationsManager')
const NotificationsBuilder = require('../Notifications/NotificationsBuilder')
const GeoIpLookup = require('../../infrastructure/GeoIpLookup')
const SplitTestHandler = require('../SplitTests/SplitTestHandler')

/** @typedef {import("./types").GetProjectsRequest} GetProjectsRequest */
/** @typedef {import("./types").GetProjectsResponse} GetProjectsResponse */
/** @typedef {import("../../../../types/project/dashboard/api").ProjectApi} ProjectApi */
/** @typedef {import("../../../../types/project/dashboard/api").Filters} Filters */
/** @typedef {import("../../../../types/project/dashboard/api").Page} Page */
/** @typedef {import("../../../../types/project/dashboard/api").Sort} Sort */
/** @typedef {import("./types").AllUsersProjects} AllUsersProjects */
/** @typedef {import("./types").MongoProject} MongoProject */

/** @typedef {import("../Tags/types").Tag} Tag */

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

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>}
 */
async function projectListPage(req, res, next) {
  // can have two values:
  // - undefined - when there's no "saas" feature or couldn't get subscription data
  // - object - the subscription data object
  let usersBestSubscription
  let survey

  const userId = SessionManager.getLoggedInUserId(req.session)
  const projectsBlobPending = _getProjects(userId).catch(err => {
    logger.err({ err, userId }, 'projects listing in background failed')
    return undefined
  })
  const user = await User.findById(
    userId,
    'email emails features lastPrimaryEmailCheck signUpDate'
  )

  // Handle case of deleted user
  if (user == null) {
    UserController.logout(req, res, next)
    return
  }

  if (Features.hasFeature('saas')) {
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
  // Institution SSO Notifications
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
      // Notification: After SSO Linked
      if (samlSession.linked) {
        notificationsInstitution.push({
          email: samlSession.institutionEmail,
          institutionName:
            samlSession.linked.universityName ||
            samlSession.linked.providerName,
          templateKey: 'notification_institution_sso_linked',
        })
      }

      // Notification: After SSO Linked or Logging in
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

      // Notification: Tried to register, but account already existed
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

  let userIsMemberOfGroupSubscription = false
  try {
    const userIsMemberOfGroupSubscriptionPromise =
      await LimitationsManager.promises.userIsMemberOfGroupSubscription(user)

    userIsMemberOfGroupSubscription =
      userIsMemberOfGroupSubscriptionPromise.isMember
  } catch (error) {
    logger.error(
      { err: error },
      'Failed to check whether user is a member of group subscription'
    )
  }

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

  let welcomePageRedesignAssignment = { variant: 'default' }

  try {
    welcomePageRedesignAssignment =
      await SplitTestHandler.promises.getAssignment(
        req,
        res,
        'welcome-page-redesign'
      )
  } catch (error) {
    logger.error(
      { err: error },
      'failed to get "welcome-page-redesign" split test assignment'
    )
  }

  const hasPaidAffiliation = userAffiliations.some(
    affiliation => affiliation.licence && affiliation.licence !== 'free'
  )

  const showGroupsAndEnterpriseBanner =
    Features.hasFeature('saas') &&
    !userIsMemberOfGroupSubscription &&
    !hasPaidAffiliation

  const groupsAndEnterpriseBannerVariant =
    showGroupsAndEnterpriseBanner &&
    _.sample(['did-you-know', 'on-premise', 'people', 'FOMO'])

  let showWritefullPromoBanner = false
  if (Features.hasFeature('saas') && !req.session.justRegistered) {
    try {
      const { variant } = await SplitTestHandler.promises.getAssignment(
        req,
        res,
        'writefull-promo-banner'
      )
      showWritefullPromoBanner = variant === 'enabled'
    } catch (error) {
      logger.warn(
        { err: error },
        'failed to get "writefull-promo-banner" split test assignment'
      )
    }
  }

  let showINRBanner = false
  if (usersBestSubscription?.type === 'free') {
    try {
      const inrGeoPricingAssignment =
        await SplitTestHandler.promises.getAssignment(
          req,
          res,
          'geo-pricing-inr'
        )
      const geoDetails = await GeoIpLookup.promises.getDetails(req.ip)
      showINRBanner =
        inrGeoPricingAssignment.variant === 'inr' &&
        geoDetails?.country_code === 'IN'
    } catch (error) {
      logger.error(
        { err: error },
        'Failed to get INR geo pricing lookup or assignment'
      )
    }
  }

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
    showWritefullPromoBanner,
    showINRBanner,
    projectDashboardReact: true, // used in navbar
    welcomePageRedesignVariant: welcomePageRedesignAssignment.variant,
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
  const { owned, readAndWrite, readOnly, tokenReadAndWrite, tokenReadOnly } =
    projects

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

module.exports = {
  projectListPage: expressify(projectListPage),
  getProjectsJson: expressify(getProjectsJson),
}

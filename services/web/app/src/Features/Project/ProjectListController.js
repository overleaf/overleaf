const _ = require('lodash')
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
const SplitTestHandler = require('../SplitTests/SplitTestHandler')
const UserPrimaryEmailCheckHandler = require('../User/UserPrimaryEmailCheckHandler')
const UserController = require('../User/UserController')

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

/** @typedef {import("./types").GetProjectsRequest} GetProjectsRequest */
/** @typedef {import("./types").GetProjectsResponse} GetProjectsResponse */
/** @typedef {import("../../../../types/project/dashboard/api").Project} Project */
/** @typedef {import("../../../../types/project/dashboard/api").Filters} Filters */
/** @typedef {import("../../../../types/project/dashboard/api").Page} Page */
/** @typedef {import("../../../../types/project/dashboard/api").Sort} Sort */
/** @typedef {import("./types").AllUsersProjects} AllUsersProjects */
/** @typedef {import("./types").MongoProject} MongoProject */

/** @typedef {import("../Tags/types").Tag} Tag */

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>}
 */
async function projectListReactPage(req, res, next) {
  // can have two values:
  // - undefined - when there's no "saas" feature or couldn't get subscription data
  // - object - the subscription data object
  let usersBestSubscription
  let survey

  const userId = SessionManager.getLoggedInUserId(req.session)
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

    try {
      const assignment = await SplitTestHandler.promises.getAssignment(
        req,
        res,
        'primary-email-check'
      )
      const primaryEmailCheckActive = assignment.variant === 'active'

      if (
        user &&
        primaryEmailCheckActive &&
        UserPrimaryEmailCheckHandler.requiresPrimaryEmailCheck(user)
      ) {
        return res.redirect('/user/emails/primary-email-check')
      }
    } catch (error) {
      logger.warn(
        { err: error },
        'failed to get "primary-email-check" split test assignment'
      )
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
          institutionName: samlSession.linked.universityName,
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

  res.render('project/list-react', {
    title: 'your_projects',
    usersBestSubscription,
    notifications,
    notificationsInstitution,
    user,
    userEmails,
    reconfirmedViaSAML,
    allInReconfirmNotificationPeriods,
    survey,
    tags,
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
  const allProjects =
    /** @type {AllUsersProjects} **/ await ProjectGetter.promises.findAllUsersProjects(
      userId,
      'name lastUpdated lastUpdatedBy publicAccesLevel archived trashed owner_ref tokens'
    )
  const tags = /** @type {Tag[]} **/ await TagsHandler.promises.getAllTags(
    userId
  )
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
    if (!_.find(formattedProjects, ['id', project._id.toString()])) {
      formattedProjects.push(
        _formatProjectInfo(project, 'readAndWrite', Sources.TOKEN, userId)
      )
    }
  }
  for (const project of tokenReadOnly) {
    if (!_.find(formattedProjects, ['id', project._id.toString()])) {
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
    id: project._id,
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

  const users = {}
  for (const userId of userIds) {
    const {
      email,
      first_name: firstName,
      last_name: lastName,
    } = await UserGetter.promises.getUser(userId, {
      first_name: 1,
      last_name: 1,
      email: 1,
    })
    users[userId] = {
      id: userId,
      email,
      firstName,
      lastName,
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
  projectListReactPage: expressify(projectListReactPage),
  getProjectsJson: expressify(getProjectsJson),
}

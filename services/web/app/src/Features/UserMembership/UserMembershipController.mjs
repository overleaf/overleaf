import SessionManager from '../Authentication/SessionManager.mjs'
import UserMembershipHandler from './UserMembershipHandler.mjs'
import Errors from '../Errors/Errors.js'
import EmailHelper from '../Helpers/EmailHelper.mjs'
import { csvAttachment } from '../../infrastructure/Response.mjs'
import UserMembershipErrors from './UserMembershipErrors.mjs'
import { SSOConfig } from '../../models/SSOConfig.mjs'
import { Parser as CSVParser } from 'json2csv'
import { expressify } from '@overleaf/promise-utils'
import logger from '@overleaf/logger'
import PlansLocator from '../Subscription/PlansLocator.mjs'
import RecurlyClient from '../Subscription/RecurlyClient.mjs'
import Modules from '../../infrastructure/Modules.mjs'
import UserMembershipAuthorization from './UserMembershipAuthorization.mjs'
import SplitTestHandler from '../SplitTests/SplitTestHandler.mjs'
import _ from 'lodash'
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'

// entity ids here may be a Mongo ObjectId-shaped subscription id (group),
// a v1 numeric institution id, or a publisher slug -- the same handlers
// serve all three entity types (see UserMembershipRouter.mjs).
const entityIdSchema = z.union([z.string(), z.number()])

async function manageGroupMembers(req, res, next) {
  const { entity: subscription, entityConfig } = req

  const entityPrimaryKey =
    subscription[entityConfig.fields.primaryKey].toString()

  let entityName
  if (entityConfig.fields.name) {
    entityName = subscription[entityConfig.fields.name]
  }

  const users = await UserMembershipHandler.promises.getUsers(
    subscription,
    entityConfig
  )
  const ssoConfig = await SSOConfig.findById(subscription.ssoConfig).exec()
  const plan = PlansLocator.findLocalPlanInSettings(subscription.planCode)
  const userId = SessionManager.getLoggedInUserId(req.session)?.toString()
  const isAdmin = subscription.admin_id.toString() === userId
  const isUserGroupManager =
    Boolean(subscription.manager_ids?.some(id => id.toString() === userId)) &&
    !isAdmin

  let recurlySubscription
  try {
    if (subscription.recurlySubscription_id) {
      recurlySubscription = await RecurlyClient.promises.getSubscription(
        subscription.recurlySubscription_id
      )
    }
  } catch (err) {
    // do not block page rendering
    logger.error(
      {
        err,
        subscription: {
          _id: subscription._id,
          recurlySubscription_id: subscription.recurlySubscription_id,
        },
      },
      'Error fetching Recurly subscription'
    )
  }

  const canUseAddSeatsFeature = Boolean(
    plan?.canUseFlexibleLicensing && isAdmin && recurlySubscription
  )

  res.render('user_membership/group-members-react', {
    name: entityName,
    groupId: entityPrimaryKey,
    users,
    groupSize: subscription.membersLimit,
    managedUsersActive: subscription.managedUsersEnabled,
    isUserGroupManager,
    groupSSOActive: ssoConfig?.enabled,
    canUseFlexibleLicensing: plan?.canUseFlexibleLicensing,
    canUseAddSeatsFeature,
    entityAccess: UserMembershipAuthorization.hasEntityAccess()(req),
    customerIoEnabled: true,
  })
}

async function manageGroupManagers(req, res, next) {
  await _renderManagersPage(
    req,
    res,
    next,
    'user_membership/group-managers-react',
    { customerIoEnabled: true }
  )
}

async function manageInstitutionManagers(req, res, next) {
  await _renderManagersPage(
    req,
    res,
    next,
    'user_membership/institution-managers-react'
  )
}

async function managePublisherManagers(req, res, next) {
  await _renderManagersPage(
    req,
    res,
    next,
    'user_membership/publisher-managers-react'
  )
}

async function _renderManagersPage(req, res, next, template, extraLocals = {}) {
  const { entity, entityConfig } = req

  const fetchV1Data = new Promise((resolve, reject) => {
    entity.fetchV1Data((error, entity) => {
      if (error) {
        reject(error)
      } else {
        resolve(entity)
      }
    })
  })

  const entityWithV1Data = await fetchV1Data

  const entityPrimaryKey =
    entityWithV1Data[entityConfig.fields.primaryKey].toString()
  let entityName
  if (entityConfig.fields.name) {
    entityName = entityWithV1Data[entityConfig.fields.name]
  }
  const users = await UserMembershipHandler.promises.getUsers(
    entityWithV1Data,
    entityConfig
  )

  res.render(template, {
    name: entityName,
    users,
    groupId: entityPrimaryKey,
    entityAccess: UserMembershipAuthorization.hasEntityAccess()(req),
    ...extraLocals,
  })
}

async function manageGroupUsers(req, res) {
  const combinedUserManagement = await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'combined-user-management'
  )
  const { entity: subscription, entityConfig } = req

  const entityPrimaryKey =
    subscription[entityConfig.fields.primaryKey].toString()

  if (combinedUserManagement.variant !== 'enabled') {
    return res.redirect(`/manage/groups/${entityPrimaryKey}/members`)
  }

  let entityName
  if (entityConfig.fields.name) {
    entityName = subscription[entityConfig.fields.name]
  }
  const userId = SessionManager.getLoggedInUserId(req.session)?.toString()
  const plan = PlansLocator.findLocalPlanInSettings(subscription.planCode)
  const isAdmin = subscription.admin_id.toString() === userId
  const recurlySubscription = subscription.recurlySubscription_id
    ? await RecurlyClient.promises.getSubscription(
        subscription.recurlySubscription_id
      )
    : undefined
  const canUseAddSeatsFeature =
    plan?.canUseFlexibleLicensing &&
    isAdmin &&
    recurlySubscription &&
    !recurlySubscription.pendingChange
  const ssoConfig = await SSOConfig.findById(subscription.ssoConfig).exec()

  const users = await UserMembershipHandler.promises.getUsers(
    subscription,
    entityConfig
  )

  const { usersNoInvites, invites } = Object.groupBy(users, user =>
    user.invite ? 'invites' : 'usersNoInvites'
  )

  const deduplicatedUsers = _.uniqBy(usersNoInvites, 'email')
  for (const invite of invites) {
    const alreadyAdded = deduplicatedUsers.find(
      user => user.email === invite.email
    )
    if (alreadyAdded) {
      alreadyAdded.invite = true
    } else {
      deduplicatedUsers.unshift(invite)
    }
  }

  res.render('user_membership/group-users-react', {
    name: entityName,
    groupId: entityPrimaryKey,
    users: deduplicatedUsers,
    groupSize: subscription.membersLimit,
    managedUsersActive: subscription.managedUsersEnabled,
    entityAccess: UserMembershipAuthorization.hasEntityAccess()(req),
    canUseAddSeatsFeature,
    groupSSOActive: ssoConfig?.enabled,
    customerIoEnabled: true,
  })
}

async function exportCsv(req, res) {
  let ssoEnabled
  const { entity, entityConfig } = req
  const fields = ['email', 'last_logged_in_at', 'last_active_at']

  const { managedUsersEnabled } = entity

  let users = await UserMembershipHandler.promises.getUsers(
    entity,
    entityConfig
  )

  if (entity.ssoConfig) {
    const ssoEnabledResult = await Modules.promises.hooks.fire(
      'hasGroupSSOEnabled',
      entity
    )
    ssoEnabled = ssoEnabledResult?.[0]
  }

  if (managedUsersEnabled) {
    fields.push('managed')
  }

  if (ssoEnabled) {
    fields.push('sso')
  }

  if (managedUsersEnabled || ssoEnabled) {
    users = users.map(user => {
      if (managedUsersEnabled) {
        user.managed =
          user.enrollment?.managedBy?.toString() === entity._id.toString()
      }

      if (ssoEnabled) {
        user.sso = !!user.enrollment?.sso?.some(
          groupLinked =>
            groupLinked.groupId.toString() === entity._id.toString()
        )
      }
      return user
    })
  }

  const csvParser = new CSVParser({ fields })

  csvAttachment(res, csvParser.parse(users), 'Group.csv')
}

const addSchema = z.object({
  body: z.strictObject({
    email: z.string(),
  }),
})

async function add(req, res) {
  const { entity, entityConfig } = req
  const { body } = parseReq(req, addSchema, { logOnly: true })
  const email = EmailHelper.parseEmail(body.email)
  if (email == null) {
    return res.status(400).json({
      error: {
        code: 'invalid_email',
        message: req.i18n.translate('invalid_email'),
      },
    })
  }
  if (entityConfig.readOnly) {
    throw new Errors.NotFoundError('Cannot add users to entity')
  }
  let user
  try {
    const auditInfo = {
      ipAddress: req.ip,
      initiatorId: SessionManager.getLoggedInUserId(req.session),
    }
    user = await UserMembershipHandler.promises.addUser(
      entity,
      entityConfig,
      email,
      auditInfo
    )
  } catch (err) {
    if (err instanceof UserMembershipErrors.UserAlreadyAddedError) {
      return res.status(400).json({
        error: {
          code: 'user_already_added',
          message: req.i18n.translate('user_already_added'),
        },
      })
    }
    if (err instanceof UserMembershipErrors.UserNotFoundError) {
      return res.status(404).json({
        error: {
          code: 'user_not_found',
          message: req.i18n.translate('add_manager_user_not_found'),
        },
      })
    }
    throw err
  }
  res.json({ user })
}

const removeSchema = z.object({
  params: z.strictObject({
    id: entityIdSchema,
    userId: zz.objectId(),
  }),
})

async function remove(req, res) {
  const { entity, entityConfig } = req
  const { params } = parseReq(req, removeSchema, { logOnly: true })
  const { userId } = params
  if (entityConfig.readOnly) {
    throw new Errors.NotFoundError('Cannot remove users from entity')
  }
  const loggedInUserId = SessionManager.getLoggedInUserId(req.session)
  if (loggedInUserId === userId) {
    return res.status(400).json({
      error: {
        code: 'managers_cannot_remove_self',
        message: req.i18n.translate('managers_cannot_remove_self'),
      },
    })
  }
  try {
    const auditInfo = {
      ipAddress: req.ip,
      initiatorId: loggedInUserId,
    }
    await UserMembershipHandler.promises.removeUser(
      entity,
      entityConfig,
      userId,
      auditInfo
    )
  } catch (err) {
    if (err instanceof UserMembershipErrors.UserIsManagerError) {
      return res.status(400).json({
        error: {
          code: 'managers_cannot_remove_admin',
          message: req.i18n.translate('managers_cannot_remove_admin'),
        },
      })
    }
    throw err
  }
  res.sendStatus(200)
}

// Unlike entityIdSchema above, this id is interpolated into
// entityConfig.pathsFor()'s redirect Location right below, and -- once
// persisted as the entity's primary key -- into Institution.mjs/
// Publisher.mjs's fetchV1DataPromise v1 API URL. Both routes creating this
// entity (publisher/institution) pass a plain Express route param, i.e. a
// single path segment on the wire, so it must not be able to introduce an
// extra path, query or fragment separator.
const createEntityIdSchema = zz.routeSegment()

const createSchema = z.object({
  params: z.strictObject({
    // `name` is never actually populated by the current router (neither
    // `/entities/publisher/create/:id` nor `/entities/institution/create/:id`
    // declares a `:name` param) but is included here, matching `new()`
    // below, since it's exercised directly at the unit-test level.
    name: z.string().optional(),
    id: createEntityIdSchema,
  }),
})

async function create(req, res) {
  const { params } = parseReq(req, createSchema, { logOnly: true })
  const entityId = params.id
  const entityConfig = req.entityConfig
  await UserMembershipHandler.promises.createEntity(entityId, entityConfig)
  res.redirect(entityConfig.pathsFor(entityId).index)
}

const newSchema = z.object({
  params: z.strictObject({
    // see the comment on createSchema above -- `name` is never populated by
    // the real router, only by unit tests calling this handler directly.
    name: z.string().optional(),
    id: entityIdSchema,
  }),
})

export default {
  manageGroupMembers: expressify(manageGroupMembers),
  manageGroupManagers: expressify(manageGroupManagers),
  manageGroupUsers: expressify(manageGroupUsers),
  manageInstitutionManagers: expressify(manageInstitutionManagers),
  managePublisherManagers: expressify(managePublisherManagers),
  add: expressify(add),
  remove: expressify(remove),
  exportCsv: expressify(exportCsv),
  new(req, res, next) {
    const { params } = parseReq(req, newSchema, { logOnly: true })
    res.render('user_membership/new', {
      entityName: params.name,
      entityId: params.id,
    })
  },
  create: expressify(create),
}

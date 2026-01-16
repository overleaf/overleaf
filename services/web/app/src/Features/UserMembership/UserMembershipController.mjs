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
    plan?.canUseFlexibleLicensing &&
    isAdmin &&
    recurlySubscription &&
    !recurlySubscription.pendingChange
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
  })
}

async function manageGroupManagers(req, res, next) {
  await _renderManagersPage(
    req,
    res,
    next,
    'user_membership/group-managers-react'
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

async function _renderManagersPage(req, res, next, template) {
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

async function add(req, res) {
  const { entity, entityConfig } = req
  const email = EmailHelper.parseEmail(req.body.email)
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
    user = await UserMembershipHandler.promises.addUser(
      entity,
      entityConfig,
      email
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

async function remove(req, res) {
  const { entity, entityConfig } = req
  const { userId } = req.params
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
    await UserMembershipHandler.promises.removeUser(
      entity,
      entityConfig,
      userId
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

async function create(req, res) {
  const entityId = req.params.id
  const entityConfig = req.entityConfig
  await UserMembershipHandler.promises.createEntity(entityId, entityConfig)
  res.redirect(entityConfig.pathsFor(entityId).index)
}

export default {
  manageGroupMembers: expressify(manageGroupMembers),
  manageGroupManagers: expressify(manageGroupManagers),
  manageInstitutionManagers: expressify(manageInstitutionManagers),
  managePublisherManagers: expressify(managePublisherManagers),
  add: expressify(add),
  remove: expressify(remove),
  exportCsv: expressify(exportCsv),
  new(req, res, next) {
    res.render('user_membership/new', {
      entityName: req.params.name,
      entityId: req.params.id,
    })
  },
  create: expressify(create),
}

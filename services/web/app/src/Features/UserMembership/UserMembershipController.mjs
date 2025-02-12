import SessionManager from '../Authentication/SessionManager.js'
import UserMembershipHandler from './UserMembershipHandler.js'
import Errors from '../Errors/Errors.js'
import EmailHelper from '../Helpers/EmailHelper.js'
import { csvAttachment } from '../../infrastructure/Response.js'
import {
  UserIsManagerError,
  UserAlreadyAddedError,
  UserNotFoundError,
} from './UserMembershipErrors.js'
import { SSOConfig } from '../../models/SSOConfig.js'
import { Parser as CSVParser } from 'json2csv'
import { expressify } from '@overleaf/promise-utils'
import SplitTestHandler from '../SplitTests/SplitTestHandler.js'
import PlansLocator from '../Subscription/PlansLocator.js'
import RecurlyClient from '../Subscription/RecurlyClient.js'

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

  await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'flexible-group-licensing'
  )

  const plan = PlansLocator.findLocalPlanInSettings(subscription.planCode)
  const userId = SessionManager.getLoggedInUserId(req.session)
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

  res.render('user_membership/group-members-react', {
    name: entityName,
    groupId: entityPrimaryKey,
    users,
    groupSize: subscription.membersLimit,
    managedUsersActive: subscription.managedUsersEnabled,
    groupSSOActive: ssoConfig?.enabled,
    canUseFlexibleLicensing: plan?.canUseFlexibleLicensing,
    canUseAddSeatsFeature,
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
  })
}

export default {
  manageGroupMembers: expressify(manageGroupMembers),
  manageGroupManagers: expressify(manageGroupManagers),
  manageInstitutionManagers: expressify(manageInstitutionManagers),
  managePublisherManagers: expressify(managePublisherManagers),
  add(req, res, next) {
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
      return next(new Errors.NotFoundError('Cannot add users to entity'))
    }

    UserMembershipHandler.addUser(
      entity,
      entityConfig,
      email,
      function (error, user) {
        if (error && error instanceof UserAlreadyAddedError) {
          return res.status(400).json({
            error: {
              code: 'user_already_added',
              message: req.i18n.translate('user_already_added'),
            },
          })
        }
        if (error && error instanceof UserNotFoundError) {
          return res.status(404).json({
            error: {
              code: 'user_not_found',
              message: req.i18n.translate('user_not_found'),
            },
          })
        }
        if (error != null) {
          return next(error)
        }
        res.json({ user })
      }
    )
  },
  remove(req, res, next) {
    const { entity, entityConfig } = req
    const { userId } = req.params

    if (entityConfig.readOnly) {
      return next(new Errors.NotFoundError('Cannot remove users from entity'))
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

    UserMembershipHandler.removeUser(
      entity,
      entityConfig,
      userId,
      function (error, user) {
        if (error && error instanceof UserIsManagerError) {
          return res.status(400).json({
            error: {
              code: 'managers_cannot_remove_admin',
              message: req.i18n.translate('managers_cannot_remove_admin'),
            },
          })
        }
        if (error != null) {
          return next(error)
        }
        res.sendStatus(200)
      }
    )
  },
  exportCsv(req, res, next) {
    const { entity, entityConfig } = req
    const fields = ['email', 'last_logged_in_at', 'last_active_at']

    UserMembershipHandler.getUsers(
      entity,
      entityConfig,
      function (error, users) {
        if (error != null) {
          return next(error)
        }
        const csvParser = new CSVParser({ fields })
        csvAttachment(res, csvParser.parse(users), 'Group.csv')
      }
    )
  },
  new(req, res, next) {
    res.render('user_membership/new', {
      entityName: req.params.name,
      entityId: req.params.id,
    })
  },
  create(req, res, next) {
    const entityId = req.params.id
    const entityConfig = req.entityConfig

    UserMembershipHandler.createEntity(
      entityId,
      entityConfig,
      function (error, entity) {
        if (error != null) {
          return next(error)
        }
        res.redirect(entityConfig.pathsFor(entityId).index)
      }
    )
  },
}

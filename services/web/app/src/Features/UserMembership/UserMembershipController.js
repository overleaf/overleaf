/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const AuthenticationController = require('../Authentication/AuthenticationController')
const UserMembershipHandler = require('./UserMembershipHandler')
const EntityConfigs = require('./UserMembershipEntityConfigs')
const Errors = require('../Errors/Errors')
const EmailHelper = require('../Helpers/EmailHelper')
const logger = require('logger-sharelatex')

module.exports = {
  index(req, res, next) {
    const { entity, entityConfig } = req
    return entity.fetchV1Data(function(error, entity) {
      if (error != null) {
        return next(error)
      }
      return UserMembershipHandler.getUsers(entity, entityConfig, function(
        error,
        users
      ) {
        let entityName
        if (error != null) {
          return next(error)
        }
        const entityPrimaryKey = entity[
          entityConfig.fields.primaryKey
        ].toString()
        if (entityConfig.fields.name) {
          entityName = entity[entityConfig.fields.name]
        }
        return res.render('user_membership/index', {
          name: entityName,
          users,
          groupSize: entityConfig.hasMembersLimit
            ? entity.membersLimit
            : undefined,
          translations: entityConfig.translations,
          paths: entityConfig.pathsFor(entityPrimaryKey)
        })
      })
    })
  },

  add(req, res, next) {
    const { entity, entityConfig } = req
    const email = EmailHelper.parseEmail(req.body.email)
    if (email == null) {
      return res.status(400).json({
        error: {
          code: 'invalid_email',
          message: req.i18n.translate('invalid_email')
        }
      })
    }

    if (entityConfig.readOnly) {
      return next(new Errors.NotFoundError('Cannot add users to entity'))
    }

    return UserMembershipHandler.addUser(entity, entityConfig, email, function(
      error,
      user
    ) {
      if (error != null ? error.alreadyAdded : undefined) {
        return res.status(400).json({
          error: {
            code: 'user_already_added',
            message: req.i18n.translate('user_already_added')
          }
        })
      }
      if (error != null ? error.userNotFound : undefined) {
        return res.status(404).json({
          error: {
            code: 'user_not_found',
            message: req.i18n.translate('user_not_found')
          }
        })
      }
      if (error != null) {
        return next(error)
      }
      return res.json({ user })
    })
  },

  remove(req, res, next) {
    const { entity, entityConfig } = req
    const { userId } = req.params

    if (entityConfig.readOnly) {
      return next(new Errors.NotFoundError('Cannot remove users from entity'))
    }

    const loggedInUserId = AuthenticationController.getLoggedInUserId(req)
    if (loggedInUserId === userId) {
      return res.status(400).json({
        error: {
          code: 'managers_cannot_remove_self',
          message: req.i18n.translate('managers_cannot_remove_self')
        }
      })
    }

    return UserMembershipHandler.removeUser(
      entity,
      entityConfig,
      userId,
      function(error, user) {
        if (error != null ? error.isAdmin : undefined) {
          return res.status(400).json({
            error: {
              code: 'managers_cannot_remove_admin',
              message: req.i18n.translate('managers_cannot_remove_admin')
            }
          })
        }
        if (error != null) {
          return next(error)
        }
        return res.send()
      }
    )
  },

  exportCsv(req, res, next) {
    const { entity, entityConfig } = req
    logger.log({ subscriptionId: entity._id }, 'exporting csv')
    return UserMembershipHandler.getUsers(entity, entityConfig, function(
      error,
      users
    ) {
      if (error != null) {
        return next(error)
      }
      let csvOutput = ''
      for (let user of Array.from(users)) {
        csvOutput += user.email + '\n'
      }
      res.header('Content-Disposition', 'attachment; filename=Group.csv')
      res.contentType('text/csv')
      return res.send(csvOutput)
    })
  },

  new(req, res, next) {
    return res.render('user_membership/new', {
      entityName: req.params.name,
      entityId: req.params.id
    })
  },

  create(req, res, next) {
    const entityName = req.params.name
    const entityId = req.params.id
    const entityConfig = EntityConfigs[entityName]
    if (!entityConfig) {
      return next(new Errors.NotFoundError(`No such entity: ${entityName}`))
    }
    if (!entityConfig.canCreate) {
      return next(new Errors.NotFoundError(`Cannot create new ${entityName}`))
    }

    return UserMembershipHandler.createEntity(entityId, entityConfig, function(
      error,
      entity
    ) {
      if (error != null) {
        return next(error)
      }
      return res.redirect(entityConfig.pathsFor(entityId).index)
    })
  }
}

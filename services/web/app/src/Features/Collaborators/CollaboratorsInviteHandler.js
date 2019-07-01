/* eslint-disable
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let CollaboratorsInviteHandler
const { ProjectInvite } = require('../../models/ProjectInvite')
const logger = require('logger-sharelatex')
const CollaboratorsEmailHandler = require('./CollaboratorsEmailHandler')
const CollaboratorsHandler = require('./CollaboratorsHandler')
const UserGetter = require('../User/UserGetter')
const ProjectGetter = require('../Project/ProjectGetter')
const Async = require('async')
const PrivilegeLevels = require('../Authorization/PrivilegeLevels')
const Errors = require('../Errors/Errors')
const Crypto = require('crypto')
const NotificationsBuilder = require('../Notifications/NotificationsBuilder')

module.exports = CollaboratorsInviteHandler = {
  getAllInvites(projectId, callback) {
    if (callback == null) {
      callback = function(err, invites) {}
    }
    logger.log({ projectId }, 'fetching invites for project')
    return ProjectInvite.find({ projectId }, function(err, invites) {
      if (err != null) {
        logger.warn({ err, projectId }, 'error getting invites from mongo')
        return callback(err)
      }
      logger.log(
        { projectId, count: invites.length },
        'found invites for project'
      )
      return callback(null, invites)
    })
  },

  getInviteCount(projectId, callback) {
    if (callback == null) {
      callback = function(err, count) {}
    }
    logger.log({ projectId }, 'counting invites for project')
    return ProjectInvite.count({ projectId }, function(err, count) {
      if (err != null) {
        logger.warn({ err, projectId }, 'error getting invites from mongo')
        return callback(err)
      }
      return callback(null, count)
    })
  },

  _trySendInviteNotification(projectId, sendingUser, invite, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    const { email } = invite
    return UserGetter.getUserByAnyEmail(email, { _id: 1 }, function(
      err,
      existingUser
    ) {
      if (err != null) {
        logger.warn({ projectId, email }, 'error checking if user exists')
        return callback(err)
      }
      if (existingUser == null) {
        logger.log({ projectId, email }, 'no existing user found, returning')
        return callback(null)
      }
      return ProjectGetter.getProject(projectId, { _id: 1, name: 1 }, function(
        err,
        project
      ) {
        if (err != null) {
          logger.warn({ projectId, email }, 'error getting project')
          return callback(err)
        }
        if (project == null) {
          logger.log(
            { projectId },
            'no project found while sending notification, returning'
          )
          return callback(null)
        }
        return NotificationsBuilder.projectInvite(
          invite,
          project,
          sendingUser,
          existingUser
        ).create(callback)
      })
    })
  },

  _tryCancelInviteNotification(inviteId, callback) {
    if (callback == null) {
      callback = function() {}
    }
    return NotificationsBuilder.projectInvite(
      { _id: inviteId },
      null,
      null,
      null
    ).read(callback)
  },

  _sendMessages(projectId, sendingUser, invite, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    logger.log(
      { projectId, inviteId: invite._id },
      'sending notification and email for invite'
    )
    return CollaboratorsEmailHandler.notifyUserOfProjectInvite(
      projectId,
      invite.email,
      invite,
      sendingUser,
      function(err) {
        if (err != null) {
          return callback(err)
        }
        return CollaboratorsInviteHandler._trySendInviteNotification(
          projectId,
          sendingUser,
          invite,
          function(err) {
            if (err != null) {
              return callback(err)
            }
            return callback()
          }
        )
      }
    )
  },

  inviteToProject(projectId, sendingUser, email, privileges, callback) {
    if (callback == null) {
      callback = function(err, invite) {}
    }
    logger.log(
      { projectId, sendingUserId: sendingUser._id, email, privileges },
      'adding invite'
    )
    return Crypto.randomBytes(24, function(err, buffer) {
      if (err != null) {
        logger.warn(
          { err, projectId, sendingUserId: sendingUser._id, email },
          'error generating random token'
        )
        return callback(err)
      }
      const token = buffer.toString('hex')
      const invite = new ProjectInvite({
        email,
        token,
        sendingUserId: sendingUser._id,
        projectId,
        privileges
      })
      return invite.save(function(err, invite) {
        if (err != null) {
          logger.warn(
            { err, projectId, sendingUserId: sendingUser._id, email },
            'error saving token'
          )
          return callback(err)
        }
        // Send email and notification in background
        CollaboratorsInviteHandler._sendMessages(
          projectId,
          sendingUser,
          invite,
          function(err) {
            if (err != null) {
              return logger.err(
                { err, projectId, email },
                'error sending messages for invite'
              )
            }
          }
        )
        return callback(null, invite)
      })
    })
  },

  revokeInvite(projectId, inviteId, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    logger.log({ projectId, inviteId }, 'removing invite')
    return ProjectInvite.remove({ projectId, _id: inviteId }, function(err) {
      if (err != null) {
        logger.warn({ err, projectId, inviteId }, 'error removing invite')
        return callback(err)
      }
      CollaboratorsInviteHandler._tryCancelInviteNotification(
        inviteId,
        function() {}
      )
      return callback(null)
    })
  },

  resendInvite(projectId, sendingUser, inviteId, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    logger.log({ projectId, inviteId }, 'resending invite email')
    return ProjectInvite.findOne({ _id: inviteId, projectId }, function(
      err,
      invite
    ) {
      if (err != null) {
        logger.warn({ err, projectId, inviteId }, 'error finding invite')
        return callback(err)
      }
      if (invite == null) {
        logger.err(
          { err, projectId, inviteId },
          'no invite found, nothing to resend'
        )
        return callback(null)
      }
      return CollaboratorsInviteHandler._sendMessages(
        projectId,
        sendingUser,
        invite,
        function(err) {
          if (err != null) {
            logger.warn(
              { projectId, inviteId },
              'error resending invite messages'
            )
            return callback(err)
          }
          return callback(null)
        }
      )
    })
  },

  getInviteByToken(projectId, tokenString, callback) {
    if (callback == null) {
      callback = function(err, invite) {}
    }
    logger.log({ projectId, tokenString }, 'fetching invite by token')
    return ProjectInvite.findOne({ projectId, token: tokenString }, function(
      err,
      invite
    ) {
      if (err != null) {
        logger.warn({ err, projectId }, 'error fetching invite')
        return callback(err)
      }
      if (invite == null) {
        logger.err({ err, projectId, token: tokenString }, 'no invite found')
        return callback(null, null)
      }
      return callback(null, invite)
    })
  },

  acceptInvite(projectId, tokenString, user, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    logger.log({ projectId, userId: user._id, tokenString }, 'accepting invite')
    return CollaboratorsInviteHandler.getInviteByToken(
      projectId,
      tokenString,
      function(err, invite) {
        if (err != null) {
          logger.warn({ err, projectId, tokenString }, 'error finding invite')
          return callback(err)
        }
        if (!invite) {
          err = new Errors.NotFoundError('no matching invite found')
          logger.log(
            { err, projectId, tokenString },
            'no matching invite found'
          )
          return callback(err)
        }
        const inviteId = invite._id
        return CollaboratorsHandler.addUserIdToProject(
          projectId,
          invite.sendingUserId,
          user._id,
          invite.privileges,
          function(err) {
            if (err != null) {
              logger.warn(
                { err, projectId, inviteId, userId: user._id },
                'error adding user to project'
              )
              return callback(err)
            }
            // Remove invite
            logger.log({ projectId, inviteId }, 'removing invite')
            return ProjectInvite.remove({ _id: inviteId }, function(err) {
              if (err != null) {
                logger.warn(
                  { err, projectId, inviteId },
                  'error removing invite'
                )
                return callback(err)
              }
              CollaboratorsInviteHandler._tryCancelInviteNotification(
                inviteId,
                function() {}
              )
              return callback()
            })
          }
        )
      }
    )
  }
}

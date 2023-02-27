/* eslint-disable
    n/handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { ProjectInvite } = require('../../models/ProjectInvite')
const OError = require('@overleaf/o-error')
const logger = require('@overleaf/logger')
const CollaboratorsEmailHandler = require('./CollaboratorsEmailHandler')
const CollaboratorsHandler = require('./CollaboratorsHandler')
const UserGetter = require('../User/UserGetter')
const ProjectGetter = require('../Project/ProjectGetter')
const Errors = require('../Errors/Errors')
const Crypto = require('crypto')
const NotificationsBuilder = require('../Notifications/NotificationsBuilder')
const { promisifyAll } = require('../../util/promises')

const CollaboratorsInviteHandler = {
  getAllInvites(projectId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    logger.debug({ projectId }, 'fetching invites for project')
    ProjectInvite.find({ projectId }, function (err, invites) {
      if (err != null) {
        OError.tag(err, 'error getting invites from mongo', {
          projectId,
        })
        return callback(err)
      }
      logger.debug(
        { projectId, count: invites.length },
        'found invites for project'
      )
      callback(null, invites)
    })
  },

  getInviteCount(projectId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    logger.debug({ projectId }, 'counting invites for project')
    ProjectInvite.countDocuments({ projectId }, function (err, count) {
      if (err != null) {
        OError.tag(err, 'error getting invites from mongo', {
          projectId,
        })
        return callback(err)
      }
      callback(null, count)
    })
  },

  _trySendInviteNotification(projectId, sendingUser, invite, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const { email } = invite
    UserGetter.getUserByAnyEmail(
      email,
      { _id: 1 },
      function (err, existingUser) {
        if (err != null) {
          OError.tag(err, 'error checking if user exists', {
            projectId,
            email,
          })
          return callback(err)
        }
        if (existingUser == null) {
          logger.debug(
            { projectId, email },
            'no existing user found, returning'
          )
          return callback(null)
        }
        ProjectGetter.getProject(
          projectId,
          { _id: 1, name: 1 },
          function (err, project) {
            if (err != null) {
              OError.tag(err, 'error getting project', {
                projectId,
                email,
              })
              return callback(err)
            }
            if (project == null) {
              logger.debug(
                { projectId },
                'no project found while sending notification, returning'
              )
              return callback(null)
            }
            NotificationsBuilder.projectInvite(
              invite,
              project,
              sendingUser,
              existingUser
            ).create(callback)
          }
        )
      }
    )
  },

  _tryCancelInviteNotification(inviteId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    NotificationsBuilder.projectInvite(
      { _id: inviteId },
      null,
      null,
      null
    ).read(callback)
  },

  _sendMessages(projectId, sendingUser, invite, callback) {
    if (callback == null) {
      callback = function () {}
    }
    logger.debug(
      { projectId, inviteId: invite._id },
      'sending notification and email for invite'
    )
    CollaboratorsEmailHandler.notifyUserOfProjectInvite(
      projectId,
      invite.email,
      invite,
      sendingUser,
      function (err) {
        if (err != null) {
          return callback(err)
        }
        CollaboratorsInviteHandler._trySendInviteNotification(
          projectId,
          sendingUser,
          invite,
          function (err) {
            if (err != null) {
              return callback(err)
            }
            callback()
          }
        )
      }
    )
  },

  inviteToProject(projectId, sendingUser, email, privileges, callback) {
    if (callback == null) {
      callback = function () {}
    }
    logger.debug(
      { projectId, sendingUserId: sendingUser._id, email, privileges },
      'adding invite'
    )
    Crypto.randomBytes(24, function (err, buffer) {
      if (err != null) {
        OError.tag(err, 'error generating random token', {
          projectId,
          sendingUserId: sendingUser._id,
          email,
        })
        return callback(err)
      }
      const token = buffer.toString('hex')
      const invite = new ProjectInvite({
        email,
        token,
        sendingUserId: sendingUser._id,
        projectId,
        privileges,
      })
      invite.save(function (err, invite) {
        if (err != null) {
          OError.tag(err, 'error saving token', {
            projectId,
            sendingUserId: sendingUser._id,
            email,
          })
          return callback(err)
        }
        // Send email and notification in background
        CollaboratorsInviteHandler._sendMessages(
          projectId,
          sendingUser,
          invite,
          function (err) {
            if (err != null) {
              return logger.err(
                { err, projectId, email },
                'error sending messages for invite'
              )
            }
          }
        )
        callback(null, invite)
      })
    })
  },

  revokeInvite(projectId, inviteId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    logger.debug({ projectId, inviteId }, 'removing invite')
    ProjectInvite.deleteOne({ projectId, _id: inviteId }, function (err) {
      if (err != null) {
        OError.tag(err, 'error removing invite', {
          projectId,
          inviteId,
        })
        return callback(err)
      }
      CollaboratorsInviteHandler._tryCancelInviteNotification(
        inviteId,
        function () {}
      )
      callback(null)
    })
  },

  resendInvite(projectId, sendingUser, inviteId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    logger.debug({ projectId, inviteId }, 'resending invite email')
    ProjectInvite.findOne({ _id: inviteId, projectId }, function (err, invite) {
      if (err != null) {
        OError.tag(err, 'error finding invite', {
          projectId,
          inviteId,
        })
        return callback(err)
      }
      if (invite == null) {
        logger.err(
          { err, projectId, inviteId },
          'no invite found, nothing to resend'
        )
        return callback(null)
      }
      CollaboratorsInviteHandler._sendMessages(
        projectId,
        sendingUser,
        invite,
        function (err) {
          if (err != null) {
            OError.tag(err, 'error resending invite messages', {
              projectId,
              inviteId,
            })
            return callback(err)
          }
          callback(null)
        }
      )
    })
  },

  getInviteByToken(projectId, tokenString, callback) {
    if (callback == null) {
      callback = function () {}
    }
    logger.debug({ projectId }, 'fetching invite by token')
    ProjectInvite.findOne(
      { projectId, token: tokenString },
      function (err, invite) {
        if (err != null) {
          OError.tag(err, 'error fetching invite', {
            projectId,
          })
          return callback(err)
        }
        if (invite == null) {
          logger.err({ err, projectId }, 'no invite found')
          return callback(null, null)
        }
        callback(null, invite)
      }
    )
  },

  acceptInvite(projectId, tokenString, user, callback) {
    if (callback == null) {
      callback = function () {}
    }
    logger.debug({ projectId, userId: user._id }, 'accepting invite')
    CollaboratorsInviteHandler.getInviteByToken(
      projectId,
      tokenString,
      function (err, invite) {
        if (err != null) {
          OError.tag(err, 'error finding invite', {
            projectId,
            tokenString,
          })
          return callback(err)
        }
        if (!invite) {
          err = new Errors.NotFoundError('no matching invite found')
          logger.debug({ err, projectId }, 'no matching invite found')
          return callback(err)
        }
        const inviteId = invite._id
        CollaboratorsHandler.addUserIdToProject(
          projectId,
          invite.sendingUserId,
          user._id,
          invite.privileges,
          function (err) {
            if (err != null) {
              OError.tag(err, 'error adding user to project', {
                projectId,
                inviteId,
                userId: user._id,
              })
              return callback(err)
            }
            // Remove invite
            logger.debug({ projectId, inviteId }, 'removing invite')
            ProjectInvite.deleteOne({ _id: inviteId }, function (err) {
              if (err != null) {
                OError.tag(err, 'error removing invite', {
                  projectId,
                  inviteId,
                })
                return callback(err)
              }
              CollaboratorsInviteHandler._tryCancelInviteNotification(
                inviteId,
                function () {}
              )
              callback()
            })
          }
        )
      }
    )
  },
}

module.exports = CollaboratorsInviteHandler
module.exports.promises = promisifyAll(CollaboratorsInviteHandler)

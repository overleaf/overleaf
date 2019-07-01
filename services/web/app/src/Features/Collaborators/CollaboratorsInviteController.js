/* eslint-disable
    camelcase,
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
let CollaboratorsInviteController
const ProjectGetter = require('../Project/ProjectGetter')
const LimitationsManager = require('../Subscription/LimitationsManager')
const UserGetter = require('../User/UserGetter')
const CollaboratorsHandler = require('./CollaboratorsHandler')
const CollaboratorsInviteHandler = require('./CollaboratorsInviteHandler')
const logger = require('logger-sharelatex')
const Settings = require('settings-sharelatex')
const EmailHelper = require('../Helpers/EmailHelper')
const EditorRealTimeController = require('../Editor/EditorRealTimeController')
const NotificationsBuilder = require('../Notifications/NotificationsBuilder')
const AnalyticsManger = require('../Analytics/AnalyticsManager')
const AuthenticationController = require('../Authentication/AuthenticationController')
const rateLimiter = require('../../infrastructure/RateLimiter')
const request = require('request')

module.exports = CollaboratorsInviteController = {
  getAllInvites(req, res, next) {
    const projectId = req.params.Project_id
    logger.log({ projectId }, 'getting all active invites for project')
    return CollaboratorsInviteHandler.getAllInvites(projectId, function(
      err,
      invites
    ) {
      if (err != null) {
        logger.warn({ projectId }, 'error getting invites for project')
        return next(err)
      }
      return res.json({ invites })
    })
  },

  _checkShouldInviteEmail(email, callback) {
    if (callback == null) {
      callback = function(err, shouldAllowInvite) {}
    }
    if (Settings.restrictInvitesToExistingAccounts === true) {
      logger.log({ email }, 'checking if user exists with this email')
      return UserGetter.getUserByAnyEmail(email, { _id: 1 }, function(
        err,
        user
      ) {
        if (err != null) {
          return callback(err)
        }
        const userExists =
          user != null && (user != null ? user._id : undefined) != null
        return callback(null, userExists)
      })
    } else {
      return callback(null, true)
    }
  },

  _checkRateLimit(user_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return LimitationsManager.allowedNumberOfCollaboratorsForUser(
      user_id,
      function(err, collabLimit) {
        if (collabLimit == null) {
          collabLimit = 1
        }
        if (err != null) {
          return callback(err)
        }
        if (collabLimit === -1) {
          collabLimit = 20
        }
        collabLimit = collabLimit * 10
        const opts = {
          endpointName: 'invite-to-project-by-user-id',
          timeInterval: 60 * 30,
          subjectName: user_id,
          throttle: collabLimit
        }
        return rateLimiter.addCount(opts, callback)
      }
    )
  },

  inviteToProject(req, res, next) {
    const projectId = req.params.Project_id
    let { email } = req.body
    const sendingUser = AuthenticationController.getSessionUser(req)
    const sendingUserId = sendingUser._id
    if (email === sendingUser.email) {
      logger.log(
        { projectId, email, sendingUserId },
        'cannot invite yourself to project'
      )
      return res.json({ invite: null, error: 'cannot_invite_self' })
    }
    logger.log({ projectId, email, sendingUserId }, 'inviting to project')
    return LimitationsManager.canAddXCollaborators(
      projectId,
      1,
      (error, allowed) => {
        let privileges
        if (error != null) {
          return next(error)
        }
        if (!allowed) {
          logger.log(
            { projectId, email, sendingUserId },
            'not allowed to invite more users to project'
          )
          return res.json({ invite: null })
        }
        ;({ email, privileges } = req.body)
        email = EmailHelper.parseEmail(email)
        if (email == null || email === '') {
          logger.log(
            { projectId, email, sendingUserId },
            'invalid email address'
          )
          return res.status(400).send({ errorReason: 'invalid_email' })
        }
        return CollaboratorsInviteController._checkRateLimit(
          sendingUserId,
          function(error, underRateLimit) {
            if (error != null) {
              return next(error)
            }
            if (!underRateLimit) {
              return res.sendStatus(429)
            }
            return CollaboratorsInviteController._checkShouldInviteEmail(
              email,
              function(err, shouldAllowInvite) {
                if (err != null) {
                  logger.warn(
                    { err, email, projectId, sendingUserId },
                    'error checking if we can invite this email address'
                  )
                  return next(err)
                }
                if (!shouldAllowInvite) {
                  logger.log(
                    { email, projectId, sendingUserId },
                    'not allowed to send an invite to this email address'
                  )
                  return res.json({
                    invite: null,
                    error: 'cannot_invite_non_user'
                  })
                }
                return CollaboratorsInviteHandler.inviteToProject(
                  projectId,
                  sendingUser,
                  email,
                  privileges,
                  function(err, invite) {
                    if (err != null) {
                      logger.warn(
                        { projectId, email, sendingUserId },
                        'error creating project invite'
                      )
                      return next(err)
                    }
                    logger.log(
                      { projectId, email, sendingUserId },
                      'invite created'
                    )
                    EditorRealTimeController.emitToRoom(
                      projectId,
                      'project:membership:changed',
                      { invites: true }
                    )
                    return res.json({ invite })
                  }
                )
              }
            )
          }
        )
      }
    )
  },

  revokeInvite(req, res, next) {
    const projectId = req.params.Project_id
    const inviteId = req.params.invite_id
    logger.log({ projectId, inviteId }, 'revoking invite')
    return CollaboratorsInviteHandler.revokeInvite(
      projectId,
      inviteId,
      function(err) {
        if (err != null) {
          logger.warn({ projectId, inviteId }, 'error revoking invite')
          return next(err)
        }
        EditorRealTimeController.emitToRoom(
          projectId,
          'project:membership:changed',
          { invites: true }
        )
        return res.sendStatus(201)
      }
    )
  },

  resendInvite(req, res, next) {
    const projectId = req.params.Project_id
    const inviteId = req.params.invite_id
    logger.log({ projectId, inviteId }, 'resending invite')
    const sendingUser = AuthenticationController.getSessionUser(req)
    return CollaboratorsInviteController._checkRateLimit(
      sendingUser._id,
      function(error, underRateLimit) {
        if (error != null) {
          return next(error)
        }
        if (!underRateLimit) {
          return res.sendStatus(429)
        }
        return CollaboratorsInviteHandler.resendInvite(
          projectId,
          sendingUser,
          inviteId,
          function(err) {
            if (err != null) {
              logger.warn({ projectId, inviteId }, 'error resending invite')
              return next(err)
            }
            return res.sendStatus(201)
          }
        )
      }
    )
  },

  viewInvite(req, res, next) {
    const projectId = req.params.Project_id
    const { token } = req.params
    const _renderInvalidPage = function() {
      logger.log(
        { projectId, token },
        'invite not valid, rendering not-valid page'
      )
      return res.render('project/invite/not-valid', { title: 'Invalid Invite' })
    }
    // check if the user is already a member of the project
    const currentUser = AuthenticationController.getSessionUser(req)
    return CollaboratorsHandler.isUserInvitedMemberOfProject(
      currentUser._id,
      projectId,
      function(err, isMember, _privilegeLevel) {
        if (err != null) {
          logger.warn(
            { err, projectId },
            'error checking if user is member of project'
          )
          return next(err)
        }
        if (isMember) {
          logger.log(
            { projectId, userId: currentUser._id },
            'user is already a member of this project, redirecting'
          )
          return res.redirect(`/project/${projectId}`)
        }
        // get the invite
        return CollaboratorsInviteHandler.getInviteByToken(
          projectId,
          token,
          function(err, invite) {
            if (err != null) {
              logger.warn({ projectId, token }, 'error getting invite by token')
              return next(err)
            }
            // check if invite is gone, or otherwise non-existent
            if (invite == null) {
              logger.log({ projectId, token }, 'no invite found for this token')
              return _renderInvalidPage()
            }
            // check the user who sent the invite exists
            return UserGetter.getUser(
              { _id: invite.sendingUserId },
              { email: 1, first_name: 1, last_name: 1 },
              function(err, owner) {
                if (err != null) {
                  logger.warn({ err, projectId }, 'error getting project owner')
                  return next(err)
                }
                if (owner == null) {
                  logger.log({ projectId }, 'no project owner found')
                  return _renderInvalidPage()
                }
                // fetch the project name
                return ProjectGetter.getProject(projectId, {}, function(
                  err,
                  project
                ) {
                  if (err != null) {
                    logger.warn({ err, projectId }, 'error getting project')
                    return next(err)
                  }
                  if (project == null) {
                    logger.log({ projectId }, 'no project found')
                    return _renderInvalidPage()
                  }
                  // finally render the invite
                  return res.render('project/invite/show', {
                    invite,
                    project,
                    owner,
                    title: 'Project Invite'
                  })
                })
              }
            )
          }
        )
      }
    )
  },

  acceptInvite(req, res, next) {
    const projectId = req.params.Project_id
    const { token } = req.params
    const currentUser = AuthenticationController.getSessionUser(req)
    logger.log(
      { projectId, userId: currentUser._id, token },
      'got request to accept invite'
    )
    return CollaboratorsInviteHandler.acceptInvite(
      projectId,
      token,
      currentUser,
      function(err) {
        if (err != null) {
          logger.warn({ projectId, token }, 'error accepting invite by token')
          return next(err)
        }
        EditorRealTimeController.emitToRoom(
          projectId,
          'project:membership:changed',
          { invites: true, members: true }
        )
        AnalyticsManger.recordEvent(currentUser._id, 'project-invite-accept', {
          projectId,
          userId: currentUser._id
        })
        if (req.xhr) {
          return res.sendStatus(204) //  Done async via project page notification
        } else {
          return res.redirect(`/project/${projectId}`)
        }
      }
    )
  }
}

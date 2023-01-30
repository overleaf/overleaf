let CollaboratorsInviteController
const OError = require('@overleaf/o-error')
const ProjectGetter = require('../Project/ProjectGetter')
const LimitationsManager = require('../Subscription/LimitationsManager')
const UserGetter = require('../User/UserGetter')
const CollaboratorsGetter = require('./CollaboratorsGetter')
const CollaboratorsInviteHandler = require('./CollaboratorsInviteHandler')
const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')
const EmailHelper = require('../Helpers/EmailHelper')
const EditorRealTimeController = require('../Editor/EditorRealTimeController')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const SessionManager = require('../Authentication/SessionManager')
const { RateLimiter } = require('../../infrastructure/RateLimiter')

// This rate limiter allows a different number of requests depending on the
// number of callaborators a user is allowed. This is implemented by providing
// a number of points (P) and consuming c = floor(P / maxRequests) on each
// request. We'd like (maxRequests + 1) requests to trigger the rate limit, so
// one constrait that we have is that c * (maxRequests + 1) > P. This is
// achieved if P = M^2 where M is the largest value possible for maxRequests.
//
// In the present case, we allow 10 requests per collaborator per 30 minutes,
// with a maximum of 200 requests, so P = 200^2 = 40000.
const RATE_LIMIT_POINTS = 40000
const rateLimiter = new RateLimiter('invite-to-project-by-user-id', {
  points: RATE_LIMIT_POINTS,
  duration: 60 * 30,
})

module.exports = CollaboratorsInviteController = {
  getAllInvites(req, res, next) {
    const projectId = req.params.Project_id
    logger.debug({ projectId }, 'getting all active invites for project')
    CollaboratorsInviteHandler.getAllInvites(
      projectId,
      function (err, invites) {
        if (err) {
          OError.tag(err, 'error getting invites for project', {
            projectId,
          })
          return next(err)
        }
        res.json({ invites })
      }
    )
  },

  _checkShouldInviteEmail(email, callback) {
    if (Settings.restrictInvitesToExistingAccounts === true) {
      logger.debug({ email }, 'checking if user exists with this email')
      UserGetter.getUserByAnyEmail(email, { _id: 1 }, function (err, user) {
        if (err) {
          return callback(err)
        }
        const userExists = user?._id != null
        callback(null, userExists)
      })
    } else {
      callback(null, true)
    }
  },

  _checkRateLimit(userId, callback) {
    LimitationsManager.allowedNumberOfCollaboratorsForUser(
      userId,
      (err, collabLimit) => {
        if (err) {
          return callback(err)
        }
        if (collabLimit == null || collabLimit === 0) {
          collabLimit = 1
        } else if (collabLimit < 0 || collabLimit > 20) {
          collabLimit = 20
        }

        // Consume enough points to hit the rate limit at 10 * collabLimit
        const maxRequests = 10 * collabLimit
        const points = Math.floor(RATE_LIMIT_POINTS / maxRequests)
        rateLimiter
          .consume(userId, points)
          .then(() => {
            callback(null, true)
          })
          .catch(err => {
            if (err instanceof Error) {
              callback(err)
            } else {
              callback(null, false)
            }
          })
      }
    )
  },

  inviteToProject(req, res, next) {
    const projectId = req.params.Project_id
    let { email } = req.body
    const sendingUser = SessionManager.getSessionUser(req.session)
    const sendingUserId = sendingUser._id
    if (email === sendingUser.email) {
      logger.debug(
        { projectId, email, sendingUserId },
        'cannot invite yourself to project'
      )
      return res.json({ invite: null, error: 'cannot_invite_self' })
    }
    logger.debug({ projectId, email, sendingUserId }, 'inviting to project')
    LimitationsManager.canAddXCollaborators(projectId, 1, (error, allowed) => {
      let privileges
      if (error) {
        return next(error)
      }
      if (!allowed) {
        logger.debug(
          { projectId, email, sendingUserId },
          'not allowed to invite more users to project'
        )
        return res.json({ invite: null })
      }
      ;({ email, privileges } = req.body)
      email = EmailHelper.parseEmail(email, true)
      if (email == null || email === '') {
        logger.debug(
          { projectId, email, sendingUserId },
          'invalid email address'
        )
        return res.status(400).json({ errorReason: 'invalid_email' })
      }
      CollaboratorsInviteController._checkRateLimit(
        sendingUserId,
        function (error, underRateLimit) {
          if (error) {
            return next(error)
          }
          if (!underRateLimit) {
            return res.sendStatus(429)
          }
          CollaboratorsInviteController._checkShouldInviteEmail(
            email,
            function (err, shouldAllowInvite) {
              if (err) {
                OError.tag(
                  err,
                  'error checking if we can invite this email address',
                  {
                    email,
                    projectId,
                    sendingUserId,
                  }
                )
                return next(err)
              }
              if (!shouldAllowInvite) {
                logger.debug(
                  { email, projectId, sendingUserId },
                  'not allowed to send an invite to this email address'
                )
                return res.json({
                  invite: null,
                  error: 'cannot_invite_non_user',
                })
              }
              CollaboratorsInviteHandler.inviteToProject(
                projectId,
                sendingUser,
                email,
                privileges,
                function (err, invite) {
                  if (err) {
                    OError.tag(err, 'error creating project invite', {
                      projectId,
                      email,
                      sendingUserId,
                    })
                    return next(err)
                  }
                  logger.debug(
                    { projectId, email, sendingUserId },
                    'invite created'
                  )
                  EditorRealTimeController.emitToRoom(
                    projectId,
                    'project:membership:changed',
                    { invites: true }
                  )
                  res.json({ invite })
                }
              )
            }
          )
        }
      )
    })
  },

  revokeInvite(req, res, next) {
    const projectId = req.params.Project_id
    const inviteId = req.params.invite_id
    logger.debug({ projectId, inviteId }, 'revoking invite')
    CollaboratorsInviteHandler.revokeInvite(
      projectId,
      inviteId,
      function (err) {
        if (err) {
          OError.tag(err, 'error revoking invite', {
            projectId,
            inviteId,
          })
          return next(err)
        }
        EditorRealTimeController.emitToRoom(
          projectId,
          'project:membership:changed',
          { invites: true }
        )
        res.sendStatus(201)
      }
    )
  },

  resendInvite(req, res, next) {
    const projectId = req.params.Project_id
    const inviteId = req.params.invite_id
    logger.debug({ projectId, inviteId }, 'resending invite')
    const sendingUser = SessionManager.getSessionUser(req.session)
    CollaboratorsInviteController._checkRateLimit(
      sendingUser._id,
      function (error, underRateLimit) {
        if (error) {
          return next(error)
        }
        if (!underRateLimit) {
          return res.sendStatus(429)
        }
        CollaboratorsInviteHandler.resendInvite(
          projectId,
          sendingUser,
          inviteId,
          function (err) {
            if (err) {
              OError.tag(err, 'error resending invite', {
                projectId,
                inviteId,
              })
              return next(err)
            }
            res.sendStatus(201)
          }
        )
      }
    )
  },

  viewInvite(req, res, next) {
    const projectId = req.params.Project_id
    const { token } = req.params
    const _renderInvalidPage = function () {
      logger.debug({ projectId }, 'invite not valid, rendering not-valid page')
      res.render('project/invite/not-valid', { title: 'Invalid Invite' })
    }
    // check if the user is already a member of the project
    const currentUser = SessionManager.getSessionUser(req.session)
    CollaboratorsGetter.isUserInvitedMemberOfProject(
      currentUser._id,
      projectId,
      function (err, isMember) {
        if (err) {
          OError.tag(err, 'error checking if user is member of project', {
            projectId,
          })
          return next(err)
        }
        if (isMember) {
          logger.debug(
            { projectId, userId: currentUser._id },
            'user is already a member of this project, redirecting'
          )
          return res.redirect(`/project/${projectId}`)
        }
        // get the invite
        CollaboratorsInviteHandler.getInviteByToken(
          projectId,
          token,
          function (err, invite) {
            if (err) {
              OError.tag(err, 'error getting invite by token', {
                projectId,
              })
              return next(err)
            }
            // check if invite is gone, or otherwise non-existent
            if (invite == null) {
              logger.debug({ projectId }, 'no invite found for this token')
              return _renderInvalidPage()
            }
            // check the user who sent the invite exists
            UserGetter.getUser(
              { _id: invite.sendingUserId },
              { email: 1, first_name: 1, last_name: 1 },
              function (err, owner) {
                if (err) {
                  OError.tag(err, 'error getting project owner', {
                    projectId,
                  })
                  return next(err)
                }
                if (owner == null) {
                  logger.debug({ projectId }, 'no project owner found')
                  return _renderInvalidPage()
                }
                // fetch the project name
                ProjectGetter.getProject(
                  projectId,
                  {},
                  function (err, project) {
                    if (err) {
                      OError.tag(err, 'error getting project', {
                        projectId,
                      })
                      return next(err)
                    }
                    if (project == null) {
                      logger.debug({ projectId }, 'no project found')
                      return _renderInvalidPage()
                    }
                    // finally render the invite
                    res.render('project/invite/show', {
                      invite,
                      project,
                      owner,
                      title: 'Project Invite',
                    })
                  }
                )
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
    const currentUser = SessionManager.getSessionUser(req.session)
    logger.debug(
      { projectId, userId: currentUser._id },
      'got request to accept invite'
    )
    CollaboratorsInviteHandler.acceptInvite(
      projectId,
      token,
      currentUser,
      function (err) {
        if (err) {
          OError.tag(err, 'error accepting invite by token', {
            projectId,
            token,
          })
          return next(err)
        }
        EditorRealTimeController.emitToRoom(
          projectId,
          'project:membership:changed',
          { invites: true, members: true }
        )
        AnalyticsManager.recordEventForUser(
          currentUser._id,
          'project-invite-accept',
          {
            projectId,
          }
        )
        if (req.xhr) {
          res.sendStatus(204) //  Done async via project page notification
        } else {
          res.redirect(`/project/${projectId}`)
        }
      }
    )
  },
}

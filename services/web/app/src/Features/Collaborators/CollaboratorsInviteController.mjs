import ProjectGetter from '../Project/ProjectGetter.mjs'
import LimitationsManager from '../Subscription/LimitationsManager.mjs'
import UserGetter from '../User/UserGetter.mjs'
import CollaboratorsGetter from './CollaboratorsGetter.mjs'
import CollaboratorsInviteHandler from './CollaboratorsInviteHandler.mjs'
import CollaboratorsInviteGetter from './CollaboratorsInviteGetter.mjs'
import CollaboratorsInviteHelper from './CollaboratorsInviteHelper.mjs'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import EmailHelper from '../Helpers/EmailHelper.mjs'
import EditorRealTimeController from '../Editor/EditorRealTimeController.mjs'
import AnalyticsManager from '../Analytics/AnalyticsManager.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import { RateLimiter } from '../../infrastructure/RateLimiter.mjs'
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'
import { expressify } from '@overleaf/promise-utils'
import ProjectAuditLogHandler from '../Project/ProjectAuditLogHandler.mjs'
import Errors from '../Errors/Errors.js'
import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import PrivilegeLevels, {
  isPrivilegeUpgrade,
} from '../Authorization/PrivilegeLevels.mjs'
import SplitTestHandler from '../SplitTests/SplitTestHandler.mjs'
import SubscriptionGroupHandler from '../Subscription/SubscriptionGroupHandler.mjs'
import SubscriptionLocator from '../Subscription/SubscriptionLocator.mjs'

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

async function getAllInvites(req, res) {
  const projectId = req.params.Project_id
  logger.debug({ projectId }, 'getting all active invites for project')
  const invites =
    await CollaboratorsInviteGetter.promises.getAllInvites(projectId)
  res.json({ invites })
}

async function _checkShouldInviteEmail(email) {
  if (Settings.restrictInvitesToExistingAccounts === true) {
    logger.debug({ email }, 'checking if user exists with this email')
    const user = await UserGetter.promises.getUserByAnyEmail(email, {
      _id: 1,
    })
    const userExists = user?._id != null
    return userExists
  } else {
    return true
  }
}

async function _checkRateLimit(userId) {
  let collabLimit =
    await LimitationsManager.promises.allowedNumberOfCollaboratorsForUser(
      userId
    )

  if (collabLimit == null || collabLimit === 0) {
    collabLimit = 1
  } else if (collabLimit < 0 || collabLimit > 20) {
    collabLimit = 20
  }

  // Consume enough points to hit the rate limit at 10 * collabLimit
  const maxRequests = 10 * collabLimit
  const points = Math.floor(RATE_LIMIT_POINTS / maxRequests)
  try {
    await rateLimiter.consume(userId, points, { method: 'userId' })
  } catch (err) {
    if (err instanceof Error) {
      throw err
    } else {
      return false
    }
  }
  return true
}

const inviteToProjectSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
  }),
  body: z.object({
    email: z.string(),
    privileges: z.enum([
      PrivilegeLevels.READ_ONLY,
      PrivilegeLevels.READ_AND_WRITE,
      PrivilegeLevels.REVIEW,
    ]),
  }),
})

async function inviteToProject(req, res) {
  const { params, body } = parseReq(req, inviteToProjectSchema)
  const projectId = params.Project_id
  let { email, privileges } = body
  const sendingUser = SessionManager.getSessionUser(req.session)
  const sendingUserId = sendingUser._id
  req.logger.addFields({ email, sendingUserId })

  if (email === sendingUser.email) {
    logger.debug(
      { projectId, email, sendingUserId },
      'cannot invite yourself to project'
    )
    return res.json({ invite: null, error: 'cannot_invite_self' })
  }

  logger.debug({ projectId, email, sendingUserId }, 'inviting to project')

  let allowed = false
  // can always invite read-only collaborators
  if (privileges === PrivilegeLevels.READ_ONLY) {
    allowed = true
  } else {
    allowed = await LimitationsManager.promises.canAddXEditCollaborators(
      projectId,
      1
    )
  }

  if (!allowed) {
    logger.debug(
      { projectId, email, sendingUserId },
      'not allowed to invite more users to project'
    )
    return res.json({ invite: null })
  }

  email = EmailHelper.parseEmail(email, true)
  if (email == null || email === '') {
    logger.debug({ projectId, email, sendingUserId }, 'invalid email address')
    return res.status(400).json({ errorReason: 'invalid_email' })
  }

  const underRateLimit =
    await CollaboratorsInviteController._checkRateLimit(sendingUserId)
  if (!underRateLimit) {
    return res.sendStatus(429)
  }

  const shouldAllowInvite =
    await CollaboratorsInviteController._checkShouldInviteEmail(email)
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

  const invite = await CollaboratorsInviteHandler.promises.inviteToProject(
    projectId,
    sendingUser,
    email,
    privileges
  )

  ProjectAuditLogHandler.addEntryInBackground(
    projectId,
    'send-invite',
    sendingUserId,
    req.ip,
    {
      inviteId: invite._id,
      role: CollaboratorsInviteHelper.privilegeLevelToRole(invite.privileges),
    }
  )

  logger.debug({ projectId, email, sendingUserId }, 'invite created')

  EditorRealTimeController.emitToRoom(projectId, 'project:membership:changed', {
    invites: true,
  })
  res.json({ invite })
}
async function revokeInvite(req, res) {
  const projectId = req.params.Project_id
  const inviteId = req.params.invite_id
  const user = SessionManager.getSessionUser(req.session)

  logger.debug({ projectId, inviteId }, 'revoking invite')

  const invite = await CollaboratorsInviteHandler.promises.revokeInvite(
    projectId,
    inviteId
  )

  if (invite != null) {
    ProjectAuditLogHandler.addEntryInBackground(
      projectId,
      'revoke-invite',
      user._id,
      req.ip,
      {
        inviteId: invite._id,
        collaboratorEmail: invite.email,
        role: CollaboratorsInviteHelper.privilegeLevelToRole(invite.privileges),
      }
    )
    EditorRealTimeController.emitToRoom(
      projectId,
      'project:membership:changed',
      { invites: true }
    )
  }

  res.sendStatus(204)
}

async function generateNewInvite(req, res) {
  const projectId = req.params.Project_id
  const inviteId = req.params.invite_id
  const user = SessionManager.getSessionUser(req.session)

  logger.debug({ projectId, inviteId }, 'resending invite')
  const sendingUser = SessionManager.getSessionUser(req.session)
  const underRateLimit = await CollaboratorsInviteController._checkRateLimit(
    sendingUser._id
  )
  if (!underRateLimit) {
    return res.sendStatus(429)
  }

  const invite = await CollaboratorsInviteHandler.promises.generateNewInvite(
    projectId,
    sendingUser,
    inviteId
  )

  EditorRealTimeController.emitToRoom(projectId, 'project:membership:changed', {
    invites: true,
  })

  if (invite != null) {
    ProjectAuditLogHandler.addEntryInBackground(
      projectId,
      'resend-invite',
      user._id,
      req.ip,
      {
        inviteId: invite._id,
        privileges: invite.privileges,
      }
    )

    res.sendStatus(201)
  } else {
    res.sendStatus(404)
  }
}

const _renderInvalidPage = function (res, projectId, sharingUpdates) {
  res.status(404)
  logger.debug({ projectId }, 'invite not valid, rendering not-valid page')
  if (sharingUpdates === 'enabled') {
    res.render('project/invite/not-valid', { title: 'Invalid Invite' })
  } else {
    res.render('project/invite/not-valid-legacy', { title: 'Invalid Invite' })
  }
}

async function viewInvite(req, res) {
  const projectId = req.params.Project_id
  const { token } = req.params

  const { variant: sharingUpdates } =
    await SplitTestHandler.promises.getAssignment(req, res, 'sharing-updates')

  // check if the user is already a member of the project
  const currentUser = SessionManager.getSessionUser(req.session)
  if (currentUser) {
    const isMember =
      await CollaboratorsGetter.promises.isUserInvitedMemberOfProject(
        currentUser._id,
        projectId
      )
    if (isMember) {
      logger.debug(
        { projectId, userId: currentUser._id },
        'user is already a member of this project, redirecting'
      )
      return res.redirect(`/project/${projectId}`)
    }
  }

  // get the invite
  const invite = await CollaboratorsInviteGetter.promises.getInviteByToken(
    projectId,
    token
  )

  // check if invite is gone, or otherwise non-existent
  if (invite == null) {
    logger.debug({ projectId }, 'no invite found for this token')
    return _renderInvalidPage(res, projectId, sharingUpdates)
  }

  // check the user who sent the invite exists
  const owner = await UserGetter.promises.getUser(
    { _id: invite.sendingUserId },
    { email: 1, first_name: 1, last_name: 1 }
  )
  if (owner == null) {
    logger.debug({ projectId }, 'no project owner found')
    return _renderInvalidPage(res, projectId, sharingUpdates)
  }

  // fetch the project name
  const project = await ProjectGetter.promises.getProject(projectId, {
    name: 1,
  })
  if (project == null) {
    logger.debug({ projectId }, 'no project found')
    return _renderInvalidPage(res, projectId, sharingUpdates)
  }

  if (!currentUser) {
    req.session.sharedProjectData = {
      project_name: project.name,
      user_first_name: owner.first_name,
    }
    AuthenticationController.setRedirectInSession(req)
    return res.redirect('/register')
  }

  // cleanup if set for register page
  delete req.session.sharedProjectData

  // finally render the invite
  if (sharingUpdates === 'enabled') {
    res.render('project/invite/show', {
      token,
      projectName: project.name,
      projectId: invite.projectId,
      title: 'Project Invite',
    })
  } else {
    res.render('project/invite/show-legacy', {
      invite,
      token,
      project,
      owner,
      title: 'Project Invite',
    })
  }
}

async function viewSharingLink(req, res) {
  const projectId = req.params.Project_id

  // ensure the project exists
  const project = await ProjectGetter.promises.getProject(projectId, {
    name: 1,
  })
  if (project == null) {
    logger.debug({ projectId }, 'no project found')
    return _renderInvalidPage(res, projectId, 'enabled')
  }

  const currentUser = SessionManager.getSessionUser(req.session)
  if (!currentUser) {
    AuthenticationController.setRedirectInSession(req)
    return res.redirect('/register')
  }

  // cleanup if set for register page
  delete req.session.sharedProjectData

  res.render('project/invite/show', {
    projectId,
    title: 'Project Invite',
  })
}

async function acceptInvite(req, res) {
  const { Project_id: projectId, token: urlToken } = req.params
  const { token: bodyToken } = req.body
  const currentUser = SessionManager.getSessionUser(req.session)
  logger.debug(
    { projectId, userId: currentUser._id },
    'got request to accept invite'
  )

  const token = urlToken || bodyToken

  const invite = await CollaboratorsInviteGetter.promises.getInviteByToken(
    projectId,
    token
  )

  if (invite == null) {
    throw new Errors.NotFoundError('no matching invite found')
  }

  if (invite.subscriptionId) {
    const isGroupMember =
      await SubscriptionGroupHandler.promises.isUserPartOfGroup(
        currentUser._id,
        invite.subscriptionId
      )
    if (!isGroupMember) {
      throw new Errors.ForbiddenError(
        'user is not part of subscription group required to accept invite'
      )
    }
  }

  // check if the user is already a member of the project and upgrade privileges if possible
  if (currentUser) {
    const currentPrivilegeLevel =
      await CollaboratorsGetter.promises.getMemberIdPrivilegeLevel(
        currentUser._id,
        projectId
      )

    if (currentPrivilegeLevel !== PrivilegeLevels.NONE) {
      if (isPrivilegeUpgrade(currentPrivilegeLevel, invite.privileges)) {
        logger.debug(
          {
            projectId,
            userId: currentUser._id,
            currentPrivilegeLevel,
            invitePrivilegeLevel: invite.privileges,
          },
          'existing member of project can be upgraded'
        )
        await CollaboratorsInviteHandler.promises.upgradeUserPrivileges(
          invite,
          projectId,
          currentUser
        )
      }
      return res.redirect(`/project/${projectId}`)
    }
  }

  if (invite.privileges === PrivilegeLevels.NONE) {
    throw new Errors.NotFoundError(
      'invite has been disabled and user is not an existing member of the project'
    )
  }

  await ProjectAuditLogHandler.promises.addEntry(
    projectId,
    'accept-invite',
    currentUser._id,
    req.ip,
    {
      inviteId: invite._id,
      collaboratorEmail: invite.email,
      privileges: invite.privileges,
    }
  )

  await CollaboratorsInviteHandler.promises.acceptInvite(
    invite,
    projectId,
    currentUser
  )

  // remove any other pending invites for user
  const userEmails = await UserGetter.promises.getUserConfirmedEmails(
    currentUser._id
  )
  await CollaboratorsInviteHandler.promises.revokeInviteForUser(
    projectId,
    userEmails
  )

  await EditorRealTimeController.emitToRoom(
    projectId,
    'project:membership:changed',
    { invites: true, members: true }
  )

  let editMode = 'edit'
  if (invite.privileges === PrivilegeLevels.REVIEW) {
    editMode = 'review'
  } else if (invite.privileges === PrivilegeLevels.READ_ONLY) {
    editMode = 'view'
  }
  AnalyticsManager.recordEventForSession(req.session, 'project-joined', {
    projectId,
    ownerId: invite.sendingUserId, // only owner can invite others
    mode: editMode,
    role: invite.privileges,
    source: urlToken ? 'email-invite' : 'sharing-link',
  })

  if (req.xhr) {
    res.sendStatus(204) //  Done async via project page notification
  } else {
    res.redirect(`/project/${projectId}`)
  }
}

async function getSharingLink(req, res) {
  const { Project_id: projectId } = req.params

  const invite =
    await CollaboratorsInviteGetter.promises.getSharingLinkInvite(projectId)

  if (invite === null || !invite.encryptedToken) {
    res.sendStatus(404)
  } else {
    const token = await CollaboratorsInviteHelper.decryptToken(
      invite.encryptedToken
    )
    res.json({
      _id: invite._id,
      token,
      privileges: invite.privileges,
      subscriptionId: invite.subscriptionId,
    })
  }
}

const updateSharingLinkSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
  }),
  body: z.object({
    // We have to use a union here, as Zod enums must be strings,
    // but NONE is defined as boolean false
    privileges: z.union([
      z.literal(PrivilegeLevels.NONE),
      z.enum([
        PrivilegeLevels.READ_ONLY,
        PrivilegeLevels.READ_AND_WRITE,
        PrivilegeLevels.REVIEW,
      ]),
    ]),
    subscriptionId: zz.objectId().optional(),
  }),
})

async function updateSharingLink(req, res) {
  const { params, body } = parseReq(req, updateSharingLinkSchema)
  const projectId = params.Project_id
  const privileges = body.privileges
  const subscriptionId = body.subscriptionId

  const currentUser = SessionManager.getSessionUser(req.session)

  if (subscriptionId) {
    const subscriptions =
      await SubscriptionLocator.promises.getUserActiveProfessionalGroupSubscriptions(
        currentUser._id,
        { _id: 1 }
      )
    const canShareWithSubscription = subscriptions.some(
      subscription => subscription._id.toString() === subscriptionId.toString()
    )

    if (!canShareWithSubscription) {
      logger.debug(
        { projectId, subscriptionId, userId: currentUser._id },
        'cannot create a group sharing link for a non-professional or non-member subscription'
      )
      return res.status(403).json({ errorReason: 'subscription_not_eligible' })
    }
  }

  let invite =
    await CollaboratorsInviteGetter.promises.getSharingLinkInvite(projectId)

  if (invite === null) {
    invite = await CollaboratorsInviteHandler.promises.createSharingLinkInvite(
      projectId,
      privileges,
      subscriptionId
    )
    await ProjectAuditLogHandler.promises.addEntry(
      projectId,
      'sharing-link-created',
      currentUser._id,
      req.ip,
      {
        inviteId: invite._id,
        privileges: invite.privileges,
        subscriptionId: invite.subscriptionId,
      }
    )
  } else {
    invite.privileges = privileges
    invite.subscriptionId = subscriptionId
    await invite.save()
    await ProjectAuditLogHandler.promises.addEntry(
      projectId,
      'sharing-link-updated',
      currentUser._id,
      req.ip,
      {
        inviteId: invite._id,
        privileges: invite.privileges,
        subscriptionId: invite.subscriptionId,
      }
    )
  }

  const token = await CollaboratorsInviteHelper.decryptToken(
    invite.encryptedToken
  )
  res.json({
    _id: invite._id,
    token,
    privileges: invite.privileges,
    subscriptionId: invite.subscriptionId,
  })
}

const validateSharingLinkSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
  }),
  body: z.object({
    token: z.string(),
  }),
})

async function validateSharingLink(req, res) {
  const { params, body } = parseReq(req, validateSharingLinkSchema)
  const projectId = params.Project_id
  const { token } = body

  const invite = await CollaboratorsInviteGetter.promises.getInviteByToken(
    projectId,
    token
  )

  const currentUser = SessionManager.getSessionUser(req.session)

  if (invite == null || !currentUser) {
    return res.json({ valid: false })
  }

  const currentPrivilegeLevel =
    await CollaboratorsGetter.promises.getMemberIdPrivilegeLevel(
      currentUser._id,
      projectId
    )

  // fetch the project name
  const project = await ProjectGetter.promises.getProject(projectId, {
    name: 1,
  })

  // If the user is already a member, check if they should be redirected to the project page
  // or shown the sharing link page based on whether the invite would upgrade their privileges
  if (currentPrivilegeLevel !== PrivilegeLevels.NONE) {
    if (
      // User can't be upgraded any further
      [PrivilegeLevels.OWNER, PrivilegeLevels.READ_AND_WRITE].includes(
        currentPrivilegeLevel
      ) ||
      // Invite is either disabled or read-only, so can't be an upgrade
      [PrivilegeLevels.READ_ONLY, PrivilegeLevels.NONE].includes(
        invite.privileges
      ) ||
      // User already has the privileges of the invite
      currentPrivilegeLevel === invite.privileges
    ) {
      return res.json({ valid: true, redirect: true })
    } else {
      return res.json({
        valid: true,
        projectName: project.name,
        redirect: false,
      })
    }
  }

  if (invite.privileges === PrivilegeLevels.NONE) {
    return res.json({ valid: false })
  }

  if (invite.subscriptionId) {
    const isGroupMember =
      await SubscriptionGroupHandler.promises.isUserPartOfGroup(
        currentUser._id,
        invite.subscriptionId
      )
    if (!isGroupMember) {
      logger.debug(
        {
          projectId,
          userId: currentUser._id,
          subscriptionId: invite.subscriptionId,
        },
        'user is not part of subscription group required to use sharing link'
      )
      return res.json({ valid: false })
    }
  }
  return res.json({ valid: true, projectName: project.name })
}

const CollaboratorsInviteController = {
  getAllInvites: expressify(getAllInvites),
  inviteToProject: expressify(inviteToProject),
  revokeInvite: expressify(revokeInvite),
  generateNewInvite: expressify(generateNewInvite),
  viewInvite: expressify(viewInvite),
  acceptInvite: expressify(acceptInvite),
  viewSharingLink: expressify(viewSharingLink),
  getSharingLink: expressify(getSharingLink),
  updateSharingLink: expressify(updateSharingLink),
  validateSharingLink: expressify(validateSharingLink),
  _checkShouldInviteEmail,
  _checkRateLimit,
}

export default CollaboratorsInviteController

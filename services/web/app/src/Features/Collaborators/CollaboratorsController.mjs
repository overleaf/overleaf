import OError from '@overleaf/o-error'
import HttpErrorHandler from '../../Features/Errors/HttpErrorHandler.mjs'
import mongodb from 'mongodb-legacy'
import CollaboratorsHandler from './CollaboratorsHandler.mjs'
import CollaboratorsGetter from './CollaboratorsGetter.mjs'
import CollaboratorsInviteHandler from './CollaboratorsInviteHandler.mjs'
import OwnershipTransferHandler from './OwnershipTransferHandler.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import EditorRealTimeController from '../Editor/EditorRealTimeController.mjs'
import TagsHandler from '../Tags/TagsHandler.mjs'
import Errors from '../Errors/Errors.js'
import logger from '@overleaf/logger'
import { expressify } from '@overleaf/promise-utils'
import AdminAuthorizationHelper from '../Helpers/AdminAuthorizationHelper.mjs'
import TokenAccessHandler from '../TokenAccess/TokenAccessHandler.mjs'
import ProjectAuditLogHandler from '../Project/ProjectAuditLogHandler.mjs'
import LimitationsManager from '../Subscription/LimitationsManager.mjs'
import PrivilegeLevels from '../Authorization/PrivilegeLevels.mjs'
import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import AnalyticsManager from '../Analytics/AnalyticsManager.mjs'
import EmailHandler from '../Email/EmailHandler.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'
import Features from '../../infrastructure/Features.mjs'
import UserGetter from '../User/UserGetter.mjs'

const { hasAdminAccess } = AdminAuthorizationHelper
const ObjectId = mongodb.ObjectId

export default {
  removeUserFromProject: expressify(removeUserFromProject),
  removeSelfFromProject: expressify(removeSelfFromProject),
  getAllMembers: expressify(getAllMembers),
  setCollaboratorInfo: expressify(setCollaboratorInfo),
  transferOwnership: expressify(transferOwnership),
  getShareTokens: expressify(getShareTokens),
  getAccessRequests: expressify(getAccessRequests),
  requestAccess: expressify(requestAccess),
  declineAccessRequest: expressify(declineAccessRequest),
  grantAccessRequest: expressify(grantAccessRequest),
}

const removeUserFromProjectSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
    user_id: zz.objectId(),
  }),
})

async function removeUserFromProject(req, res, next) {
  const { params } = parseReq(req, removeUserFromProjectSchema, {
    logOnly: true,
  })
  const projectId = params.Project_id
  const userId = params.user_id
  const sessionUserId = SessionManager.getLoggedInUserId(req.session)
  await _removeUserIdFromProject(projectId, userId)
  EditorRealTimeController.emitToRoom(projectId, 'project:membership:changed', {
    members: true,
  })

  const removedUser = await UserGetter.promises.getUser(
    { _id: userId },
    { email: 1 }
  )

  ProjectAuditLogHandler.addEntryInBackground(
    projectId,
    'remove-collaborator',
    sessionUserId,
    req.ip,
    {
      userId,
      collaboratorEmail: removedUser?.email,
    }
  )

  res.sendStatus(204)
}

const removeSelfFromProjectSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
  }),
})

async function removeSelfFromProject(req, res, next) {
  const { params } = parseReq(req, removeSelfFromProjectSchema, {
    logOnly: true,
  })
  const projectId = params.Project_id
  const userId = SessionManager.getLoggedInUserId(req.session)
  await _removeUserIdFromProject(projectId, userId)
  EditorRealTimeController.emitToRoom(projectId, 'project:membership:changed', {
    members: true,
  })

  ProjectAuditLogHandler.addEntryInBackground(
    projectId,
    'leave-project',
    userId,
    req.ip
  )

  res.sendStatus(204)
}

const getAllMembersSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
  }),
})

async function getAllMembers(req, res, next) {
  const { params } = parseReq(req, getAllMembersSchema, { logOnly: true })
  const projectId = params.Project_id
  logger.debug({ projectId }, 'getting all active members for project')
  let members
  try {
    members = await CollaboratorsGetter.promises.getAllInvitedMembers(projectId)
  } catch (err) {
    throw OError.tag(err, 'error getting members for project', { projectId })
  }
  res.json({ members })
}

const getAccessRequestsSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
  }),
})

// The pending access requests carry requester identities, so this is admin
// gated by the router (ensureUserCanAdminProject). A requester's own
// `myAccessRequest` is delivered via the editor bootstrap instead.
async function getAccessRequests(req, res) {
  const { params } = parseReq(req, getAccessRequestsSchema, {
    logOnly: true,
  })
  const projectId = params.Project_id
  const projectAccess =
    await CollaboratorsGetter.promises.getProjectAccess(projectId)
  const editAccessRequests = await projectAccess.loadAccessRequestsView()
  res.json({ editAccessRequests })
}

const setCollaboratorInfoSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
    user_id: zz.objectId(),
  }),
  body: z.strictObject({
    privilegeLevel: z.enum([
      PrivilegeLevels.READ_ONLY,
      PrivilegeLevels.READ_AND_WRITE,
      PrivilegeLevels.REVIEW,
    ]),
  }),
})

// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const setCollaboratorInfoFallbackSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
    user_id: zz.objectId(),
  }),
  body: z.object({
    privilegeLevel: z.enum([
      PrivilegeLevels.READ_ONLY,
      PrivilegeLevels.READ_AND_WRITE,
      PrivilegeLevels.REVIEW,
    ]),
  }),
})

async function setCollaboratorInfo(req, res, next) {
  try {
    const { params, body } = parseReq(req, setCollaboratorInfoSchema, {
      fallbackSchema: setCollaboratorInfoFallbackSchema,
    })
    const projectId = params.Project_id
    const userId = params.user_id
    const { privilegeLevel } = body

    const allowed =
      await LimitationsManager.promises.canChangeCollaboratorPrivilegeLevel(
        projectId,
        userId,
        privilegeLevel
      )
    if (!allowed) {
      return HttpErrorHandler.forbidden(
        req,
        res,
        'edit collaborator limit reached'
      )
    }

    const auditInfo = {
      ipAddress: req.ip,
      initiatorId: SessionManager.getLoggedInUserId(req.session),
    }

    await CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel(
      projectId,
      userId,
      privilegeLevel,
      {},
      auditInfo
    )
    EditorRealTimeController.emitToRoom(
      projectId,
      'project:collaboratorAccessLevel:changed',
      { userId }
    )
    res.sendStatus(204)
  } catch (err) {
    if (err instanceof Errors.NotFoundError) {
      HttpErrorHandler.notFound(req, res)
    } else {
      next(err)
    }
  }
}

const transferOwnershipSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
  }),
  body: z.strictObject({
    user_id: zz.objectId(),
  }),
})

// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const transferOwnershipFallbackSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
  }),
  body: z.object({
    user_id: zz.objectId(),
  }),
})

async function transferOwnership(req, res, next) {
  const sessionUser = SessionManager.getSessionUser(req.session)
  const { params, body } = parseReq(req, transferOwnershipSchema, {
    fallbackSchema: transferOwnershipFallbackSchema,
  })
  const projectId = params.Project_id
  const toUserId = body.user_id
  try {
    await OwnershipTransferHandler.promises.transferOwnership(
      projectId,
      toUserId,
      {
        allowTransferToNonCollaborators: hasAdminAccess(sessionUser),
        sessionUserId: new ObjectId(sessionUser._id),
        ipAddress: req.ip,
      }
    )
    res.sendStatus(204)
  } catch (err) {
    if (err instanceof Errors.ProjectNotFoundError) {
      HttpErrorHandler.notFound(req, res, `project not found: ${projectId}`)
    } else if (err instanceof Errors.UserNotFoundError) {
      HttpErrorHandler.notFound(req, res, `user not found: ${toUserId}`)
    } else if (err instanceof Errors.UserNotCollaboratorError) {
      HttpErrorHandler.forbidden(
        req,
        res,
        `user ${toUserId} should be a collaborator in project ${projectId} prior to ownership transfer`
      )
    } else {
      next(err)
    }
  }
}

const requestAccessSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
  }),
  body: z.strictObject({
    privilegeLevel: z.enum([
      PrivilegeLevels.READ_AND_WRITE,
      PrivilegeLevels.REVIEW,
    ]),
  }),
})

// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const requestAccessFallbackSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
  }),
  body: z.object({
    privilegeLevel: z.enum([
      PrivilegeLevels.READ_AND_WRITE,
      PrivilegeLevels.REVIEW,
    ]),
  }),
})

// Which privilege levels a caller may request, keyed by the level they
// currently hold. Viewers can ask for editor or reviewer; reviewers can only
// ask for editor (the one level above them). Anyone else (owner / editor)
// has nothing to request.
const REQUESTABLE_LEVELS_BY_CURRENT_LEVEL = {
  [PrivilegeLevels.READ_ONLY]: [
    PrivilegeLevels.READ_AND_WRITE,
    PrivilegeLevels.REVIEW,
  ],
  [PrivilegeLevels.REVIEW]: [PrivilegeLevels.READ_AND_WRITE],
}

async function requestAccess(req, res) {
  const { params, body } = parseReq(req, requestAccessSchema, {
    fallbackSchema: requestAccessFallbackSchema,
  })
  const projectId = params.Project_id
  const { privilegeLevel } = body
  const userId = SessionManager.getLoggedInUserId(req.session)
  const currentPrivilegeLevel =
    await AuthorizationManager.promises.getPrivilegeLevelForProject(
      userId,
      projectId
    )
  const requestableLevels =
    REQUESTABLE_LEVELS_BY_CURRENT_LEVEL[currentPrivilegeLevel]
  if (!requestableLevels?.includes(privilegeLevel)) {
    return HttpErrorHandler.forbidden(req, res)
  }
  const { isNew } = await CollaboratorsHandler.promises.requestAccess(
    projectId,
    userId,
    privilegeLevel
  )
  EditorRealTimeController.emitToRoom(projectId, 'project:membership:changed', {
    accessRequests: true,
  })
  if (isNew) {
    _notifyOwnerOfAccessRequest(projectId, userId, privilegeLevel).catch(
      err => {
        logger.error(
          { err, projectId, userId, privilegeLevel },
          'failed to notify owner of access request'
        )
      }
    )
    AnalyticsManager.recordEventForUserInBackground(
      userId,
      'project-access-requested',
      { projectId, currentPrivilegeLevel, privilegeLevel }
    )
  }
  res.sendStatus(204)
}

const declineAccessRequestSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
    user_id: zz.objectId(),
  }),
  body: z.strictObject({
    notify: z.boolean().optional(),
  }),
})

// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const declineAccessRequestFallbackSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
    user_id: zz.objectId(),
  }),
  body: z.object({
    notify: z.boolean().optional(),
  }),
})

async function declineAccessRequest(req, res) {
  const { params, body } = parseReq(req, declineAccessRequestSchema, {
    fallbackSchema: declineAccessRequestFallbackSchema,
  })
  const projectId = params.Project_id
  const userId = params.user_id
  const notify = body.notify === true
  const sessionUserId = SessionManager.getLoggedInUserId(req.session)
  const { removed, privilegeLevel } =
    await CollaboratorsHandler.promises.declineAccessRequest(projectId, userId)
  EditorRealTimeController.emitToRoom(projectId, 'project:membership:changed', {
    accessRequests: true,
  })
  if (removed) {
    AnalyticsManager.recordEventForUserInBackground(
      sessionUserId,
      'project-access-request-actioned',
      { projectId, privilegeLevel, decision: 'deny' }
    )
    if (notify) {
      _notifyRequesterOfOutcome(
        projectId,
        userId,
        'declined',
        privilegeLevel
      ).catch(err => {
        logger.error(
          { err, projectId, userId },
          'failed to notify requester of declined access request'
        )
      })
    }
  }
  res.sendStatus(204)
}

const grantAccessRequestSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
    user_id: zz.objectId(),
  }),
  body: z.strictObject({
    privilegeLevel: z.enum([
      PrivilegeLevels.READ_AND_WRITE,
      PrivilegeLevels.REVIEW,
    ]),
    notify: z.boolean().optional(),
  }),
})

// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const grantAccessRequestFallbackSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
    user_id: zz.objectId(),
  }),
  body: z.object({
    privilegeLevel: z.enum([
      PrivilegeLevels.READ_AND_WRITE,
      PrivilegeLevels.REVIEW,
    ]),
    notify: z.boolean().optional(),
  }),
})

async function grantAccessRequest(req, res) {
  const { params, body } = parseReq(req, grantAccessRequestSchema, {
    fallbackSchema: grantAccessRequestFallbackSchema,
  })
  const projectId = params.Project_id
  const requesterId = params.user_id
  const { privilegeLevel, notify } = body
  const sessionUserId = SessionManager.getLoggedInUserId(req.session)

  // Capture the requester's current access and any pending request up front:
  // the request tells us whether to notify (setCollaboratorPrivilegeLevel
  // clears it as a side effect), and the current level lets us keep a repeat
  // grant idempotent.
  const projectAccess =
    await CollaboratorsGetter.promises.getProjectAccess(projectId)
  const currentPrivilegeLevel = projectAccess.privilegeLevelForUser(requesterId)
  const hadRequest = Boolean(projectAccess.getAccessRequestForUser(requesterId))

  // Granting editor/reviewer access consumes an edit-collaborator slot, so
  // refuse if it would push the project over its collaborator limit — same
  // guard the regular "change privilege level" flow uses. Skip it when the
  // requester already holds the target level, so retrying a grant that
  // already succeeded stays idempotent even at the limit.
  if (currentPrivilegeLevel !== privilegeLevel) {
    const allowed =
      await LimitationsManager.promises.canChangeCollaboratorPrivilegeLevel(
        projectId,
        requesterId,
        privilegeLevel
      )
    if (!allowed) {
      return HttpErrorHandler.forbidden(
        req,
        res,
        'edit collaborator limit reached'
      )
    }
  }

  // A NotFoundError (requester is no longer a member) is translated to a 404
  // by the error-handling middleware.
  await CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel(
    projectId,
    requesterId,
    privilegeLevel,
    {},
    {
      ipAddress: req.ip,
      initiatorId: sessionUserId,
    }
  )

  // The requester is now a named collaborator, so clear any pending email
  // invite they may still have (e.g. they were invited by email but joined
  // via a sharing link before requesting edit access). Mirrors the
  // token-access join flow; a failure here shouldn't fail the grant.
  try {
    const requesterEmails =
      await UserGetter.promises.getUserConfirmedEmails(requesterId)
    await CollaboratorsInviteHandler.promises.revokeInviteForUser(
      projectId,
      requesterEmails
    )
  } catch (err) {
    logger.error(
      { err, projectId, requesterId },
      'failed to revoke pending invite after granting access request'
    )
  }

  EditorRealTimeController.emitToRoom(
    projectId,
    'project:collaboratorAccessLevel:changed',
    { userId: requesterId }
  )
  EditorRealTimeController.emitToRoom(projectId, 'project:membership:changed', {
    members: true,
    invites: true,
    accessRequests: true,
  })

  if (hadRequest) {
    AnalyticsManager.recordEventForUserInBackground(
      sessionUserId,
      'project-access-request-actioned',
      { projectId, privilegeLevel, decision: 'accept' }
    )
    if (notify) {
      _notifyRequesterOfOutcome(
        projectId,
        requesterId,
        'granted',
        privilegeLevel
      ).catch(err => {
        logger.error(
          { err, projectId, requesterId, privilegeLevel },
          'failed to notify requester of granted access request'
        )
      })
    }
  }
  res.sendStatus(204)
}

async function _notifyRequesterOfOutcome(
  projectId,
  requesterId,
  outcome,
  privilegeLevel
) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    _id: 1,
    name: 1,
  })
  if (!project) return
  const requester = await UserGetter.promises.getUser(requesterId, {
    email: 1,
    first_name: 1,
    last_name: 1,
  })
  if (!requester?.email) return
  const template =
    outcome === 'granted' ? 'accessRequestGranted' : 'accessRequestDeclined'
  await EmailHandler.promises.sendEmail(template, {
    to: requester.email,
    project,
    requester,
    privilegeLevel,
  })
}

async function _notifyOwnerOfAccessRequest(
  projectId,
  requesterId,
  privilegeLevel
) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    _id: 1,
    name: 1,
    owner_ref: 1,
  })
  if (!project?.owner_ref) return
  const users = await UserGetter.promises.getUsers(
    [project.owner_ref, requesterId],
    {
      email: 1,
      first_name: 1,
      last_name: 1,
    }
  )
  const usersById = new Map(users.map(user => [user._id.toString(), user]))
  const owner = usersById.get(project.owner_ref.toString())
  const requester = usersById.get(requesterId.toString())
  if (!owner?.email || !requester) return
  await EmailHandler.promises.sendEmail('accessRequest', {
    to: owner.email,
    project,
    owner,
    requester,
    privilegeLevel,
  })
}

async function _removeUserIdFromProject(projectId, userId) {
  await CollaboratorsHandler.promises.removeUserFromProject(projectId, userId)
  EditorRealTimeController.emitToRoom(
    projectId,
    'userRemovedFromProject',
    userId
  )
  await TagsHandler.promises.removeProjectFromAllTags(userId, projectId)
}

const getShareTokensSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
  }),
})

async function getShareTokens(req, res) {
  const { params } = parseReq(req, getShareTokensSchema, { logOnly: true })
  const projectId = params.Project_id
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!Features.hasFeature('link-sharing')) {
    return res.sendStatus(403) // return Forbidden if link sharing is not enabled
  }

  let tokens
  if (userId) {
    tokens = await CollaboratorsGetter.promises.getPublicShareTokens(
      new ObjectId(userId),
      new ObjectId(projectId)
    )
  } else {
    // anonymous access, the token is already available in the session
    const readOnly = TokenAccessHandler.getRequestToken(req, projectId)
    tokens = { readOnly }
  }
  if (!tokens) {
    return res.sendStatus(403)
  }

  if (tokens.readOnly || tokens.readAndWrite) {
    logger.info(
      {
        projectId,
        userId: userId || 'anonymous',
        ip: req.ip,
        tokens: Object.keys(tokens),
      },
      'project tokens accessed'
    )
  }

  if (tokens.readOnly) {
    tokens.readOnlyHashPrefix = TokenAccessHandler.createTokenHashPrefix(
      tokens.readOnly
    )
  }

  if (tokens.readAndWrite) {
    tokens.readAndWriteHashPrefix = TokenAccessHandler.createTokenHashPrefix(
      tokens.readAndWrite
    )
  }

  res.json(tokens)
}

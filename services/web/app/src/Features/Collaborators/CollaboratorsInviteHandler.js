const { callbackify } = require('util')
const { ProjectInvite } = require('../../models/ProjectInvite')
const logger = require('@overleaf/logger')
const CollaboratorsEmailHandler = require('./CollaboratorsEmailHandler')
const CollaboratorsHandler = require('./CollaboratorsHandler')
const CollaboratorsInviteGetter = require('./CollaboratorsInviteGetter')
const CollaboratorsInviteHelper = require('./CollaboratorsInviteHelper')
const UserGetter = require('../User/UserGetter')
const ProjectGetter = require('../Project/ProjectGetter')
const NotificationsBuilder = require('../Notifications/NotificationsBuilder')
const PrivilegeLevels = require('../Authorization/PrivilegeLevels')
const SplitTestHandler = require('../SplitTests/SplitTestHandler')
const LimitationsManager = require('../Subscription/LimitationsManager')
const ProjectAuditLogHandler = require('../Project/ProjectAuditLogHandler')
const _ = require('lodash')

const CollaboratorsInviteHandler = {
  async _trySendInviteNotification(projectId, sendingUser, invite) {
    const { email } = invite
    const existingUser = await UserGetter.promises.getUserByAnyEmail(email, {
      _id: 1,
    })
    if (existingUser == null) {
      logger.debug({ projectId, email }, 'no existing user found, returning')
      return null
    }
    const project = await ProjectGetter.promises.getProject(projectId, {
      _id: 1,
      name: 1,
    })
    if (project == null) {
      logger.debug(
        { projectId },
        'no project found while sending notification, returning'
      )
      return null
    }
    await NotificationsBuilder.promises
      .projectInvite(invite, project, sendingUser, existingUser)
      .create()
  },

  async _tryCancelInviteNotification(inviteId) {
    return await NotificationsBuilder.promises
      .projectInvite({ _id: inviteId }, null, null, null)
      .read()
  },

  async _sendMessages(projectId, sendingUser, invite) {
    logger.debug(
      { projectId, inviteId: invite._id },
      'sending notification and email for invite'
    )
    await CollaboratorsEmailHandler.promises.notifyUserOfProjectInvite(
      projectId,
      invite.email,
      invite,
      sendingUser
    )
    await CollaboratorsInviteHandler._trySendInviteNotification(
      projectId,
      sendingUser,
      invite
    )
  },

  async inviteToProject(projectId, sendingUser, email, privileges) {
    logger.debug(
      { projectId, sendingUserId: sendingUser._id, email, privileges },
      'adding invite'
    )
    const token = CollaboratorsInviteHelper.generateToken()
    const tokenHmac = CollaboratorsInviteHelper.hashInviteToken(token)
    let invite = new ProjectInvite({
      email,
      tokenHmac,
      sendingUserId: sendingUser._id,
      projectId,
      privileges,
    })
    invite = await invite.save()
    invite = invite.toObject()

    // Send email and notification in background
    CollaboratorsInviteHandler._sendMessages(projectId, sendingUser, {
      ...invite,
      token,
    }).catch(err => {
      logger.err({ err, projectId, email }, 'error sending messages for invite')
    })

    return _.pick(invite, ['_id', 'email', 'privileges'])
  },

  async revokeInviteForUser(projectId, targetEmails) {
    logger.debug({ projectId }, 'getting all active invites for project')
    const invites =
      await CollaboratorsInviteGetter.promises.getAllInvites(projectId)
    const matchingInvite = invites.find(invite =>
      targetEmails.some(emailData => emailData.email === invite.email)
    )
    if (matchingInvite) {
      await CollaboratorsInviteHandler.revokeInvite(
        projectId,
        matchingInvite._id
      )
    }
  },

  async revokeInvite(projectId, inviteId) {
    logger.debug({ projectId, inviteId }, 'removing invite')
    const invite = await ProjectInvite.findOneAndDelete({
      projectId,
      _id: inviteId,
    }).exec()
    CollaboratorsInviteHandler._tryCancelInviteNotification(inviteId).catch(
      err => {
        logger.err(
          { err, projectId, inviteId },
          'failed to cancel invite notification'
        )
      }
    )
    return invite
  },

  async generateNewInvite(projectId, sendingUser, inviteId) {
    logger.debug({ projectId, inviteId }, 'generating new invite email')
    const invite = await this.revokeInvite(projectId, inviteId)

    if (invite == null) {
      logger.warn(
        { projectId, inviteId },
        'no invite found, nothing to generate'
      )
      return null
    }

    return await this.inviteToProject(
      projectId,
      sendingUser,
      invite.email,
      invite.privileges
    )
  },

  async acceptInvite(invite, projectId, user) {
    const project = await ProjectGetter.promises.getProject(projectId, {
      owner_ref: 1,
    })
    const linkSharingEnforcement =
      await SplitTestHandler.promises.getAssignmentForUser(
        project.owner_ref,
        'link-sharing-enforcement'
      )
    const pendingEditor =
      invite.privileges === PrivilegeLevels.READ_AND_WRITE &&
      linkSharingEnforcement?.variant === 'active' &&
      !(await LimitationsManager.promises.canAcceptEditCollaboratorInvite(
        project._id
      ))
    if (pendingEditor) {
      logger.debug(
        { projectId, userId: user._id },
        'no collaborator slots available, user added as read only (pending editor)'
      )
      await ProjectAuditLogHandler.promises.addEntry(
        projectId,
        'editor-moved-to-pending', // controller already logged accept-invite
        null,
        null,
        {
          userId: user._id.toString(),
        }
      )
    }

    await CollaboratorsHandler.promises.addUserIdToProject(
      projectId,
      invite.sendingUserId,
      user._id,
      pendingEditor ? PrivilegeLevels.READ_ONLY : invite.privileges,
      { pendingEditor }
    )

    // Remove invite
    const inviteId = invite._id
    logger.debug({ projectId, inviteId }, 'removing invite')
    await ProjectInvite.deleteOne({ _id: inviteId }).exec()
    CollaboratorsInviteHandler._tryCancelInviteNotification(inviteId).catch(
      err => {
        logger.error(
          { err, projectId, inviteId },
          'failed to cancel invite notification'
        )
      }
    )
  },
}

module.exports = {
  promises: CollaboratorsInviteHandler,
  inviteToProject: callbackify(CollaboratorsInviteHandler.inviteToProject),
  revokeInviteForUser: callbackify(
    CollaboratorsInviteHandler.revokeInviteForUser
  ),
  revokeInvite: callbackify(CollaboratorsInviteHandler.revokeInvite),
  generateNewInvite: callbackify(CollaboratorsInviteHandler.generateNewInvite),
  acceptInvite: callbackify(CollaboratorsInviteHandler.acceptInvite),
  _trySendInviteNotification: callbackify(
    CollaboratorsInviteHandler._trySendInviteNotification
  ),
  _tryCancelInviteNotification: callbackify(
    CollaboratorsInviteHandler._tryCancelInviteNotification
  ),
  _sendMessages: callbackify(CollaboratorsInviteHandler._sendMessages),
}

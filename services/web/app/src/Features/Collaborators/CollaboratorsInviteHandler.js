const { callbackify, promisify } = require('util')
const { ProjectInvite } = require('../../models/ProjectInvite')
const logger = require('@overleaf/logger')
const CollaboratorsEmailHandler = require('./CollaboratorsEmailHandler')
const CollaboratorsHandler = require('./CollaboratorsHandler')
const CollaboratorsInviteHelper = require('./CollaboratorsInviteHelper')
const UserGetter = require('../User/UserGetter')
const ProjectGetter = require('../Project/ProjectGetter')
const Crypto = require('crypto')
const NotificationsBuilder = require('../Notifications/NotificationsBuilder')
const PrivilegeLevels = require('../Authorization/PrivilegeLevels')

const randomBytes = promisify(Crypto.randomBytes)

const CollaboratorsInviteHandler = {
  async getAllInvites(projectId) {
    logger.debug({ projectId }, 'fetching invites for project')
    const invites = await ProjectInvite.find({ projectId }).exec()
    logger.debug(
      { projectId, count: invites.length },
      'found invites for project'
    )
    return invites
  },

  async getInviteCount(projectId) {
    logger.debug({ projectId }, 'counting invites for project')
    const count = await ProjectInvite.countDocuments({ projectId }).exec()
    return count
  },

  async getEditInviteCount(projectId) {
    logger.debug({ projectId }, 'counting edit invites for project')
    const count = await ProjectInvite.countDocuments({
      projectId,
      privileges: { $ne: PrivilegeLevels.READ_ONLY },
    }).exec()
    return count
  },

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
    const buffer = await randomBytes(24)
    const token = buffer.toString('hex')
    const tokenHmac = CollaboratorsInviteHelper.hashInviteToken(token)
    let invite = new ProjectInvite({
      email,
      token,
      tokenHmac,
      sendingUserId: sendingUser._id,
      projectId,
      privileges,
    })
    invite = await invite.save()

    // Send email and notification in background
    CollaboratorsInviteHandler._sendMessages(
      projectId,
      sendingUser,
      invite
    ).catch(err => {
      logger.err({ err, projectId, email }, 'error sending messages for invite')
    })

    return invite
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

  async resendInvite(projectId, sendingUser, inviteId) {
    logger.debug({ projectId, inviteId }, 'resending invite email')
    const invite = await ProjectInvite.findOne({
      _id: inviteId,
      projectId,
    }).exec()

    if (invite == null) {
      logger.warn({ projectId, inviteId }, 'no invite found, nothing to resend')
      return null
    }

    await CollaboratorsInviteHandler._sendMessages(
      projectId,
      sendingUser,
      invite
    )

    return invite
  },

  async getInviteByToken(projectId, tokenString) {
    logger.debug({ projectId }, 'fetching invite by token')
    const invite = await ProjectInvite.findOne({
      projectId,
      tokenHmac: CollaboratorsInviteHelper.hashInviteToken(tokenString),
    }).exec()

    if (invite == null) {
      logger.err({ projectId }, 'no invite found')
      return null
    }

    return invite
  },

  async acceptInvite(invite, projectId, user) {
    await CollaboratorsHandler.promises.addUserIdToProject(
      projectId,
      invite.sendingUserId,
      user._id,
      invite.privileges
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
  getAllInvites: callbackify(CollaboratorsInviteHandler.getAllInvites),
  getInviteCount: callbackify(CollaboratorsInviteHandler.getInviteCount),
  inviteToProject: callbackify(CollaboratorsInviteHandler.inviteToProject),
  revokeInvite: callbackify(CollaboratorsInviteHandler.revokeInvite),
  resendInvite: callbackify(CollaboratorsInviteHandler.resendInvite),
  getInviteByToken: callbackify(CollaboratorsInviteHandler.getInviteByToken),
  acceptInvite: callbackify(CollaboratorsInviteHandler.acceptInvite),
  _trySendInviteNotification: callbackify(
    CollaboratorsInviteHandler._trySendInviteNotification
  ),
  _tryCancelInviteNotification: callbackify(
    CollaboratorsInviteHandler._tryCancelInviteNotification
  ),
  _sendMessages: callbackify(CollaboratorsInviteHandler._sendMessages),
}

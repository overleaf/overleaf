import { callbackify } from 'node:util'
import { Project } from '../../models/Project.mjs'
import EmailHandler from '../Email/EmailHandler.mjs'
import Settings from '@overleaf/settings'

const CollaboratorsEmailHandler = {
  _buildInviteUrl(project, invite) {
    return `${Settings.siteUrl}/project/${project._id}/invite/token/${invite.token}`
  },

  async notifyUserOfProjectInvite(projectId, email, invite, sendingUser) {
    // eslint-disable-next-line no-restricted-syntax
    const project = await Project.findOne({ _id: projectId })
      .select('name owner_ref')
      .populate('owner_ref')
      .exec()
    const emailOptions = {
      to: email,
      replyTo: project.owner_ref.email,
      project: {
        name: project.name,
      },
      inviteUrl: CollaboratorsEmailHandler._buildInviteUrl(project, invite),
      owner: project.owner_ref,
      sendingUser_id: sendingUser._id,
    }
    await EmailHandler.promises.sendEmail('projectInvite', emailOptions)
  },
}

export default {
  promises: CollaboratorsEmailHandler,
  notifyUserOfProjectInvite: callbackify(
    CollaboratorsEmailHandler.notifyUserOfProjectInvite
  ),
  _buildInviteUrl: CollaboratorsEmailHandler._buildInviteUrl,
}

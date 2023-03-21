/* eslint-disable
    n/handle-callback-err,
    max-len,
*/
let CollaboratorsEmailHandler
const { Project } = require('../../models/Project')
const EmailHandler = require('../Email/EmailHandler')
const Settings = require('@overleaf/settings')

module.exports = CollaboratorsEmailHandler = {
  _buildInviteUrl(project, invite) {
    return (
      `${Settings.siteUrl}/project/${project._id}/invite/token/${invite.token}?` +
      [
        `project_name=${encodeURIComponent(project.name)}`,
        `user_first_name=${encodeURIComponent(project.owner_ref.first_name)}`,
      ].join('&')
    )
  },

  notifyUserOfProjectInvite(projectId, email, invite, sendingUser, callback) {
    Project.findOne({ _id: projectId })
      .select('name owner_ref')
      .populate('owner_ref')
      .exec(function (err, project) {
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
        EmailHandler.sendEmail('projectInvite', emailOptions, callback)
      })
  },
}

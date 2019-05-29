/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let CollaboratorsEmailHandler
const { Project } = require('../../models/Project')
const EmailHandler = require('../Email/EmailHandler')
const Settings = require('settings-sharelatex')

module.exports = CollaboratorsEmailHandler = {
  _buildInviteUrl(project, invite) {
    return (
      `${Settings.siteUrl}/project/${project._id}/invite/token/${
        invite.token
      }?` +
      [
        `project_name=${encodeURIComponent(project.name)}`,
        `user_first_name=${encodeURIComponent(project.owner_ref.first_name)}`
      ].join('&')
    )
  },

  notifyUserOfProjectInvite(project_id, email, invite, sendingUser, callback) {
    return Project.findOne({ _id: project_id })
      .select('name owner_ref')
      .populate('owner_ref')
      .exec(function(err, project) {
        const emailOptions = {
          to: email,
          replyTo: project.owner_ref.email,
          project: {
            name: project.name
          },
          inviteUrl: CollaboratorsEmailHandler._buildInviteUrl(project, invite),
          owner: project.owner_ref,
          sendingUser_id: sendingUser._id
        }
        return EmailHandler.sendEmail('projectInvite', emailOptions, callback)
      })
  }
}

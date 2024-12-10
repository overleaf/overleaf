const { UserSchema } = require('../../models/User')
const SplitTestHandler = require('../SplitTests/SplitTestHandler')
const ProjectGetter = require('../Project/ProjectGetter')
const { callbackify } = require('@overleaf/promise-utils')

module.exports = {
  hasAnyStaffAccess,
  isReviewerRoleEnabled: callbackify(isReviewerRoleEnabled),
  promises: {
    isReviewerRoleEnabled,
  },
}

function hasAnyStaffAccess(user) {
  if (!user.staffAccess) {
    return false
  }

  for (const key of Object.keys(UserSchema.obj.staffAccess)) {
    if (user.staffAccess[key]) return true
  }
  return false
}

async function isReviewerRoleEnabled(userId, projectId) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    reviewer_refs: 1,
    owner_ref: 1,
  })

  // if there are reviewers, it means the role is enabled
  if (Object.keys(project.reviewer_refs || {}).length > 0) {
    return true
  }

  // if there are no reviewers, check split test from project owner
  if (project.owner_ref === userId) {
    const reviewerRoleAssigment =
      await SplitTestHandler.promises.getAssignmentForUser(
        userId,
        'reviewer-role'
      )

    return reviewerRoleAssigment.variant === 'enabled'
  }

  return false
}

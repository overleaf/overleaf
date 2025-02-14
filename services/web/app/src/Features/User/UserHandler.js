const { callbackify, promisify } = require('@overleaf/promise-utils')
const TeamInvitesHandler = require('../Subscription/TeamInvitesHandler')
const {
  db,
  READ_PREFERENCE_SECONDARY,
} = require('../../infrastructure/mongodb')

function populateTeamInvites(user, callback) {
  TeamInvitesHandler.createTeamInvitesForLegacyInvitedEmail(
    user.email,
    callback
  )
}

async function countActiveUsers() {
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  return await db.users.countDocuments(
    { lastActive: { $gte: oneYearAgo } },
    { readPreference: READ_PREFERENCE_SECONDARY }
  )
}

module.exports = {
  populateTeamInvites,
  countActiveUsers: callbackify(countActiveUsers),
}
module.exports.promises = {
  populateTeamInvites: promisify(populateTeamInvites),
  countActiveUsers,
}

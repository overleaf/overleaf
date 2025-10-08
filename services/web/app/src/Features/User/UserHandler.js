const { callbackify } = require('util')
const TeamInvitesHandler = require('../Subscription/TeamInvitesHandler')
const {
  db,
  READ_PREFERENCE_SECONDARY,
} = require('../../infrastructure/mongodb')

async function populateTeamInvites(user) {
  return await TeamInvitesHandler.promises.createTeamInvitesForLegacyInvitedEmail(
    user.email
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
  populateTeamInvites: callbackify(populateTeamInvites),
  countActiveUsers: callbackify(countActiveUsers),
  promises: {
    populateTeamInvites,
    countActiveUsers,
  },
}

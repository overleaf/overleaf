const { callbackify } = require('@overleaf/promise-utils')
const { User } = require('../../models/User')

async function getReferedUsers(userId) {
  const projection = { refered_users: 1, refered_user_count: 1 }
  const user = await User.findById(userId, projection).exec()
  const referedUsers = user.refered_users || []
  const referedUserCount = user.refered_user_count || referedUsers.length
  return { referedUsers, referedUserCount }
}

module.exports = {
  getReferedUsers: callbackify(getReferedUsers),
  promises: {
    getReferedUsers,
  },
}

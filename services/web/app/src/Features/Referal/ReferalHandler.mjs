import { callbackify } from '@overleaf/promise-utils'
import { User } from '../../models/User.js'

async function getReferedUsers(userId) {
  const projection = { refered_users: 1, refered_user_count: 1 }
  const user = await User.findById(userId, projection).exec()
  const referedUsers = user.refered_users || []
  const referedUserCount = user.refered_user_count || referedUsers.length
  return { referedUsers, referedUserCount }
}

export default {
  getReferedUsers: callbackify(getReferedUsers),
  promises: {
    getReferedUsers,
  },
}

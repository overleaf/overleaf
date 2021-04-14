const { User } = require('../../models/User')

module.exports = {
  getReferedUsers(userId, callback) {
    const projection = { refered_users: 1, refered_user_count: 1 }
    User.findById(userId, projection, function (err, user) {
      if (err) {
        return callback(err)
      }
      const referedUsers = user.refered_users || []
      const referedUserCount = user.refered_user_count || referedUsers.length
      callback(null, referedUsers, referedUserCount)
    })
  }
}

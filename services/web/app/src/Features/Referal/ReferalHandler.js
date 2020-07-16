const { User } = require('../../models/User')

module.exports = {
  getReferedUsers(userId, callback) {
    User.findById(userId, { refered_users: 1 }, function(err, user) {
      if (err) {
        return callback(err)
      }
      const referedUsers = user.refered_users || []
      const referedUserCount = user.refered_user_count || referedUsers.length
      callback(null, referedUsers, referedUserCount)
    })
  }
}

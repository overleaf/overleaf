const UserGetter = require('./UserGetter')

const UserInfoManager = {
  getPersonalInfo(userId, callback) {
    UserGetter.getUser(
      userId,
      { _id: true, first_name: true, last_name: true, email: true },
      callback
    )
  }
}

module.exports = UserInfoManager

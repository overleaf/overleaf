const UserGetter = require('./UserGetter')
const { callbackify } = require('@overleaf/promise-utils')

async function getPersonalInfo(userId) {
  return UserGetter.promises.getUser(userId, {
    _id: true,
    first_name: true,
    last_name: true,
    email: true,
  })
}

module.exports = {
  getPersonalInfo: callbackify(getPersonalInfo),
  promises: {
    getPersonalInfo,
  },
}

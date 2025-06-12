const UserInfoController = require('../User/UserInfoController')
const UserGetter = require('../User/UserGetter')
const { callbackify } = require('@overleaf/promise-utils')

async function injectUserInfoIntoThreads(threads) {
  const userIds = new Set()
  for (const thread of Object.values(threads)) {
    if (thread.resolved) {
      userIds.add(thread.resolved_by_user_id)
    }
    for (const message of thread.messages) {
      userIds.add(message.user_id)
    }
  }

  const projection = {
    _id: true,
    first_name: true,
    last_name: true,
    email: true,
  }
  const users = await UserGetter.promises.getUsers(userIds, projection)
  const usersById = new Map()
  for (const user of users) {
    usersById.set(
      user._id.toString(),
      UserInfoController.formatPersonalInfo(user)
    )
  }
  for (const thread of Object.values(threads)) {
    if (thread.resolved) {
      thread.resolved_by_user = usersById.get(thread.resolved_by_user_id)
    }
    for (const message of thread.messages) {
      message.user = usersById.get(message.user_id)
    }
  }
  return threads
}

module.exports = {
  injectUserInfoIntoThreads: callbackify(injectUserInfoIntoThreads),
  promises: {
    injectUserInfoIntoThreads,
  },
}

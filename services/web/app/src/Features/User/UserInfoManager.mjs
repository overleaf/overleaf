import UserGetter from './UserGetter.mjs'
import { callbackify } from '@overleaf/promise-utils'

async function getPersonalInfo(userId) {
  return UserGetter.promises.getUser(userId, {
    _id: true,
    first_name: true,
    last_name: true,
    email: true,
  })
}

export default {
  getPersonalInfo: callbackify(getPersonalInfo),
  promises: {
    getPersonalInfo,
  },
}

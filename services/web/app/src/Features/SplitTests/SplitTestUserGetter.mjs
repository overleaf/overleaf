import { callbackify } from 'node:util'
import Metrics from '@overleaf/metrics'
import UserGetter from '../User/UserGetter.mjs'

async function getUser(id, splitTestName) {
  const projection = {
    analyticsId: 1,
    alphaProgram: 1,
    betaProgram: 1,
  }
  if (splitTestName) {
    projection[`splitTests.${splitTestName}`] = 1
  } else {
    projection.splitTests = 1
  }
  const user = await UserGetter.promises.getUser(id, projection)
  Metrics.histogram(
    'split_test_get_user_from_mongo_size',
    JSON.stringify(user).length,
    [0, 100, 500, 1000, 2000, 5000, 10000, 15000, 20000, 50000, 100000]
  )
  return user
}

export default {
  getUser: callbackify(getUser),
  promises: {
    getUser,
  },
}

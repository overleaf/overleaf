import { callbackify } from 'node:util'
import Metrics from '@overleaf/metrics'
import UserGetter from '../User/UserGetter.mjs'

/**
 * A mongo user fetched with the projection from `getProjection`, carrying the
 * fields the split test assignment logic reads. This is the shape the
 * `*ForMongoUser` SplitTestHandler methods expect.
 *
 * @typedef {object} SplitTestUser
 * @property {import('mongodb').ObjectId} _id
 * @property {string} analyticsId
 * @property {boolean} [alphaProgram]
 * @property {boolean} [betaProgram]
 * @property {boolean} labsProgram
 * @property {string[]} [labsExperiments]
 * @property {Record<string, unknown>} [splitTests]
 */

/**
 * Build the mongo projection needed to compute split test assignments for a user.
 *
 * Call-sites that already fetch a user and want to pass it to one of the
 * `*ForMongoUser` SplitTestHandler methods should spread this into their own
 * projection, so the user carries exactly the fields the assignment logic reads.
 *
 * @param {string} [splitTestName] restrict the `splitTests` sub-document to a
 *   single test (for feature-flag style lookups); omit to fetch all assignments.
 */
function getProjection(splitTestName) {
  const projection = {
    analyticsId: 1,
    alphaProgram: 1,
    betaProgram: 1,
    labsProgram: 1,
    labsExperiments: 1,
  }
  if (splitTestName) {
    projection[`splitTests.${splitTestName}`] = 1
  } else {
    projection.splitTests = 1
  }
  return projection
}

/**
 * @param id
 * @param {string} splitTestName
 * @param {string} path
 * @return {Promise<SplitTestUser>}
 */
async function getUser(id, splitTestName, path) {
  Metrics.inc('split_test_get_user', 1, { path })
  const projection = getProjection(splitTestName)
  const user = await UserGetter.promises.getUser(id, projection)
  Metrics.histogram(
    'split_test_get_user_from_mongo_size',
    JSON.stringify(user).length,
    [0, 100, 500, 1000, 2000, 5000, 10000, 15000, 20000, 50000, 100000]
  )
  return user
}

export default {
  getProjection,
  getUser: callbackify(getUser),
  promises: {
    getUser,
  },
}

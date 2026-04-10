import { promiseMapWithLimit } from '@overleaf/promise-utils'
import Settings from '@overleaf/settings'
import { waitForDb, db } from '../app/src/infrastructure/mongodb.mjs'
import GracefulShutdown from '../app/src/infrastructure/GracefulShutdown.mjs'
import UserRegistrationHandler from '../app/src/Features/User/UserRegistrationHandler.mjs'
import minimist from 'minimist'
import {
  createProjectWithOldHistoryId,
  provisionSplitTests,
} from './e2e_test_setup.mjs'

const { email: USER_EMAIL, password: PASSWORD } = minimist(
  process.argv.slice(2),
  { string: ['email', 'password'] }
)

/**
 * @param {string} email
 * @return {Promise<string>}
 */
async function createUser(email) {
  let userId
  try {
    const user = await UserRegistrationHandler.promises.registerNewUser({
      email,
      password: PASSWORD,
    })
    userId = user._id
  } catch (err) {
    if (err.message.includes('EmailAlreadyRegistered')) {
      userId = err.info.userId
    } else {
      throw err
    }
  }
  const features = email.startsWith('free')
    ? Settings.defaultFeatures
    : Settings.features.professional
  const isAdmin = email === USER_EMAIL || email === 'admin@overleaf.com'
  let adminRoles = []
  if (isAdmin) {
    adminRoles = ['engineering']
  }
  await db.users.updateOne(
    { _id: userId },
    {
      $set: {
        // Set admin flag.
        isAdmin,
        adminRoles,
        // Override features.
        features,
        featuresOverrides: [{ features }],
        // disable AI features, does not work with custom GH Code Spaces domain.
        'aiFeatures.enabled': false,
      },
    }
  )
  return userId.toString()
}

/**
 * @param {string} email
 * @return {Promise<void>}
 */
async function provisionUser(email) {
  const userId = await createUser(email)
  await createProjectWithOldHistoryId(userId)
}

async function provisionUsers() {
  const emails = [
    USER_EMAIL,
    'admin@overleaf.com',
    'free@overleaf.com',
    'premium@overleaf.com',
  ]
  await promiseMapWithLimit(5, emails, provisionUser)
}

async function main() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('only available in dev-env')
  }
  await waitForDb()
  await Promise.all([provisionUsers(), provisionSplitTests()])
}

if (import.meta.main) {
  await main()
  await GracefulShutdown.gracefulShutdown()
}

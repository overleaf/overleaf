// @ts-check
import Settings from '@overleaf/settings'
import { waitForDb, db, ObjectId } from '../app/src/infrastructure/mongodb.mjs'
import GracefulShutdown from '../app/src/infrastructure/GracefulShutdown.mjs'
import UserRegistrationHandler from '../app/src/Features/User/UserRegistrationHandler.mjs'
import { Subscription } from '../app/src/models/Subscription.mjs'
import minimist from 'minimist'
import {
  createProjectWithOldHistoryId,
  provisionSplitTests,
} from './e2e_test_setup.mjs'
import { Project } from '../app/src/models/Project.mjs'
import OError from '@overleaf/o-error'

const { email: USER_EMAIL, password: PASSWORD } = minimist(
  process.argv.slice(2),
  { string: ['email', 'password'] }
)

/**
 * @param {string} email
 * @param {Object} opts
 * @param {boolean?} opts.isAdmin
 * @param {boolean?} opts.forceProfessional
 * @return {Promise<string>}
 */
async function createUser(
  email,
  opts = { isAdmin: false, forceProfessional: false }
) {
  const { isAdmin = false, forceProfessional = false } = opts
  /** @type {import('mongodb-legacy').ObjectId} */
  let userId
  try {
    const user = await UserRegistrationHandler.promises.registerNewUser({
      email,
      password: PASSWORD,
    })
    userId = user._id
  } catch (err) {
    if (
      err instanceof OError &&
      err.message.includes('EmailAlreadyRegistered') &&
      err.info &&
      'userId' in err.info &&
      err.info.userId instanceof ObjectId
    ) {
      userId = err.info.userId
    } else {
      throw err
    }
  }
  /** @type {string[]} */
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
        // disable AI features, does not work with custom GH Code Spaces domain.
        'aiFeatures.enabled': false,
        // Override features.
        ...(forceProfessional
          ? {
              features: Settings.features.professional,
              featuresOverrides: [{ features: Settings.features.professional }],
            }
          : {}),
      },
    }
  )
  return userId.toString()
}

async function provisionUsers() {
  await Promise.all([
    createUser(USER_EMAIL, { isAdmin: true, forceProfessional: true }),
    createUser('admin@overleaf.com', {
      isAdmin: true,
      forceProfessional: true,
    }),
    createUser('free@overleaf.com'),
    createUser('premium@overleaf.com').then(async userId => {
      const subscription = new Subscription({
        admin_id: userId,
        member_ids: [userId],
        manager_ids: [userId],
        planCode: 'professional',
        customAccount: true,
      })
      try {
        await subscription.save()
      } catch (err) {
        if (!isAlreadyExistsErr(err)) throw err // ignore already exists error
      }
    }),
    createUser('group-owner@overleaf.com').then(async userId => {
      const memberId = await createUser('group-member@overleaf.com')
      const subscription = new Subscription({
        admin_id: userId,
        member_ids: [memberId],
        manager_ids: [userId],
        groupPlan: true,
        planCode: 'group_professional_10_enterprise',
        membersLimit: 10,
        teamName: 'Test Team',
        customAccount: true,
      })
      try {
        await subscription.save()
      } catch (err) {
        if (!isAlreadyExistsErr(err)) throw err // ignore already exists error
      }
    }),
    createUser('with-old-history@overleaf.com', {
      isAdmin: true,
      forceProfessional: true,
    }).then(async userId => {
      const projectName = 'old history id (Uses v1 postgres storage)'
      const ownedProjects = await Project.find(
        { owner_ref: userId },
        { name: true }
      ).exec()
      for (const project of ownedProjects) {
        if (project.name === projectName) return
      }
      await createProjectWithOldHistoryId(userId, projectName)
    }),
  ])
}

/**
 * @param {unknown} err
 * @return {boolean}
 */
function isAlreadyExistsErr(err) {
  return err instanceof Error && 'code' in err && err.code === 11000
}

async function main() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('only available in dev-env')
  }
  await waitForDb()
  await Promise.all([provisionUsers(), provisionSplitTests(true)])
}

if (import.meta.main) {
  await main()
  await GracefulShutdown.gracefulShutdown()
}

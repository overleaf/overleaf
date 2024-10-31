import {
  db,
  READ_PREFERENCE_SECONDARY,
} from '../app/src/infrastructure/mongodb.js'
import UserSessionsManager from '../app/src/Features/User/UserSessionsManager.js'

const COMMIT = process.argv.includes('--commit')
const KEEP_SESSIONS = process.argv.includes('--keep-sessions')

const FULL_STAFF_ACCESS = {
  publisherMetrics: true,
  publisherManagement: true,
  institutionMetrics: true,
  institutionManagement: true,
  groupMetrics: true,
  groupManagement: true,
  adminMetrics: true,
  splitTestMetrics: true,
  splitTestManagement: true,
}

function doesNotHaveFullStaffAccess(user) {
  if (!user.staffAccess) {
    return true
  }
  for (const field of Object.keys(FULL_STAFF_ACCESS)) {
    if (!user.staffAccess[field]) {
      return true
    }
  }
  return false
}

function formatUser(user) {
  user = Object.assign({}, user, user.staffAccess)
  delete user.staffAccess
  return user
}

async function main() {
  const adminUsers = await db.users
    .find(
      { isAdmin: true },
      {
        projection: {
          _id: 1,
          email: 1,
          staffAccess: 1,
        },
        readPreference: READ_PREFERENCE_SECONDARY,
      }
    )
    .toArray()

  console.log('All Admin users:')
  console.table(adminUsers.map(formatUser))

  const incompleteUsers = adminUsers.filter(doesNotHaveFullStaffAccess)
  if (incompleteUsers.length === 0) {
    console.warn('All Admin users have full staff access.')
    return
  }

  console.log()
  console.log('Incomplete staff access:')
  console.table(incompleteUsers.map(formatUser))

  if (COMMIT) {
    for (const user of incompleteUsers) {
      console.error(
        `Granting ${user.email} (${user._id.toString()}) full staff access`
      )
      await db.users.updateOne(
        { _id: user._id, isAdmin: true },
        { $set: { staffAccess: FULL_STAFF_ACCESS } }
      )
      if (!KEEP_SESSIONS) {
        await UserSessionsManager.promises.removeSessionsFromRedis(user)
      }
    }
  } else {
    console.warn('Use --commit to grant missing staff access.')
  }
}

try {
  await main()
  console.error('Done.')
  process.exit(0)
} catch (error) {
  console.error({ error })
  process.exit(1)
}

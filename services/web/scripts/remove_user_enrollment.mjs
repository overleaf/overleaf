// This script will:
// 1. remove enrollment.managedBy and enrollment.enrolledAt fields from the User record
// 2. remove the user_id from member_ids on the Subscription record
//
// Usage:
// $ node scripts/remove_user_enrollment.mjs --id USER_ID --commit

import minimist from 'minimist'
import { ObjectId } from '../app/src/infrastructure/mongodb.mjs'
import { User } from '../app/src/models/User.mjs'
import { Subscription } from '../app/src/models/Subscription.mjs'
import UserAuditLogHandler from '../app/src/Features/User/UserAuditLogHandler.mjs'

const argv = minimist(process.argv.slice(2))
const COMMIT = argv.commit !== undefined
if (!COMMIT) {
  console.warn('Doing dry run without --commit')
}

const userId = argv.id
if (!userId) throw new Error('missing user ID (use --id)')

async function _handleUser(userId) {
  const user = await User.findById(userId, { enrollment: 1 })
  if (!user) {
    throw new Error(`user ${userId} does not exist`)
  }

  if (!user.enrollment?.managedBy) {
    throw new Error(`user ${userId} has no enrollment`)
  }

  const subscriptionId = user.enrollment.managedBy

  if (COMMIT) {
    await Subscription.updateOne(
      { _id: subscriptionId },
      { $pull: { member_ids: userId } }
    )
  } else {
    console.log(
      `Would remove user ${userId} from subscription ${subscriptionId}`
    )
  }

  if (COMMIT) {
    await User.updateOne(
      { _id: userId },
      {
        $unset: {
          'enrollment.managedBy': 1,
          'enrollment.enrolledAt': 1,
        },
      }
    )
  } else {
    console.log(`Would remove enrollment from user ${userId}`)
  }

  if (COMMIT) {
    await UserAuditLogHandler.promises.addEntry(
      userId,
      'release-managed-user',
      undefined,
      undefined,
      { script: true, subscriptionId, comment: 'removed by support' }
    )
  } else {
    console.log(
      `Would create user audit log "release-managed-user" with comment "removed by support"`
    )
  }
}

async function processUser(userId) {
  console.log('---Starting remove enrollment script---')
  console.log(`Will process user: ${userId}`)

  if (!ObjectId.isValid(userId)) {
    throw new Error(`user ID not valid: ${userId}`)
  }

  try {
    await _handleUser(new ObjectId(userId))
    console.log(`User ${userId} processed successfully`)
  } catch (error) {
    console.log(`Failed to process user ${userId}:`, error)
  }

  process.exit()
}

await processUser(userId)

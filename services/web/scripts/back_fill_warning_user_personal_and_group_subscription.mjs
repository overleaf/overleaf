import NotificationsBuilder from '../app/src/Features/Notifications/NotificationsBuilder.js'
import { db } from '../app/src/infrastructure/mongodb.js'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

const DRY_RUN = !process.argv.includes('--dry-run=false')

if (DRY_RUN) {
  console.log('Doing dry run')
}

async function processBatch(groupSubscriptionsBatch) {
  console.log('\n')
  console.log('----- Batch computation started -----')
  const flattenedMemberIds = groupSubscriptionsBatch
    .map(sub => sub.member_ids)
    .flatMap(memberId => memberId)
  const uniqueFlattenedMemberIds = [...new Set(flattenedMemberIds)]

  const userWithIndividualAndGroupSubscriptions = await db.subscriptions
    .find({
      groupPlan: false,
      'recurlyStatus.state': 'active',
      admin_id: { $in: uniqueFlattenedMemberIds },
    })
    .toArray()

  console.log(
    `Found ${userWithIndividualAndGroupSubscriptions.length} affected users in this batch`
  )

  if (DRY_RUN) {
    console.error('---')
    console.error('Dry-run enabled, use --dry-run=false to commit changes')
    console.error('---')
  } else {
    if (userWithIndividualAndGroupSubscriptions.length > 0) {
      console.log(
        `Notifying ${userWithIndividualAndGroupSubscriptions.length} users`
      )

      for (const notif of userWithIndividualAndGroupSubscriptions) {
        await NotificationsBuilder.promises
          .personalAndGroupSubscriptions(notif.admin_id.toString())
          .create()
      }

      console.log(
        `${userWithIndividualAndGroupSubscriptions.length} users successfully notified in this batch`
      )
    } else {
      console.log(
        'No users currently subscribe to both individual and group subscription in this batch'
      )
    }
  }
}

async function main() {
  await batchedUpdate(db.subscriptions, { groupPlan: true }, processBatch, {
    member_ids: 1,
  })
}

try {
  await main()
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}

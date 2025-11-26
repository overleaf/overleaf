// dry run:
// node scripts/merge_group_subscription_members \
//  --target [targetSubscriptionId] --source [sourceSubscriptionId]
//
// commit changes:
// node scripts/merge_group_subscription_members \
//  --target [targetSubscriptionId] --source [sourceSubscriptionId] --commit

import { db, ObjectId } from '../app/src/infrastructure/mongodb.mjs'

import SubscriptionUpdater from '../app/src/Features/Subscription/SubscriptionUpdater.mjs'
import minimist from 'minimist'
import { scriptRunner } from './lib/ScriptRunner.mjs'
const argv = minimist(process.argv.slice(2), {
  string: ['target', 'source'],
  boolean: ['commit'],
})
const { target, source, commit } = argv

async function getSubscription(subscriptionId) {
  const projection = {
    member_ids: 1,
    membersLimit: 1,
    groupPlan: 1,
    teamName: 1,
  }
  return await db.subscriptions.findOne(
    {
      _id: subscriptionId,
    },
    { projection }
  )
}

async function main() {
  if (!target) {
    throw new Error('missing --target argument')
  }
  if (!source) {
    throw new Error('missing --source argument')
  }

  if (!commit) {
    console.log('Doing dry run without --commit')
  }

  const targetSubscription = await getSubscription(new ObjectId(target))
  const sourceSubscription = await getSubscription(new ObjectId(source))

  if (!targetSubscription) {
    throw new Error('couldnt find target (to) subscription')
  }
  if (!sourceSubscription) {
    throw new Error('couldnt find source (from) subscription')
  }

  console.log(
    `\nTarget/destination subscription (${targetSubscription.member_ids.length} members) is:`,
    targetSubscription
  )
  console.log(
    `\nSource subscription (${sourceSubscription.member_ids.length} members) is:`,
    sourceSubscription
  )

  if (!targetSubscription.groupPlan || !sourceSubscription.groupPlan) {
    throw new Error('both subscriptions must be group subscriptions')
  }

  let addCount = 0
  for (const member of sourceSubscription.member_ids) {
    const exists = targetSubscription.member_ids.find(m => {
      return m.toString() === member.toString()
    })
    if (!exists) {
      console.log(`adding ${member} to target ${targetSubscription._id}`)
      addCount += 1
      if (commit) {
        await SubscriptionUpdater.promises.addUserToGroup(
          targetSubscription._id,
          member
        )
      }
    } else {
      console.log(`skipping ${member}, already exists in target`)
    }
  }

  console.log(`Added ${addCount} users to target subscription`)

  if (!commit) {
    console.log('Run again with --commit to make the above changes')
  }
}

try {
  await scriptRunner(main)
  console.error('Done.')
  process.exit(0)
} catch (error) {
  console.error({ error })
  process.exit(1)
}

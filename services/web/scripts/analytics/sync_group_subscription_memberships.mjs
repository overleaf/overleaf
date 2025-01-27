import GoogleBigQueryHelper from './helpers/GoogleBigQueryHelper.mjs'
import { Subscription } from '../../app/src/models/Subscription.js'
import AnalyticsManager from '../../app/src/Features/Analytics/AnalyticsManager.js'
import { DeletedSubscription } from '../../app/src/models/DeletedSubscription.js'
import minimist from 'minimist'
import _ from 'lodash'
import mongodb from 'mongodb-legacy'

const { ObjectId } = mongodb

let FETCH_LIMIT, COMMIT, VERBOSE

async function main() {
  console.log('## Syncing group subscription memberships...')

  const subscriptionsCount = await Subscription.countDocuments({
    groupPlan: true,
  })
  const deletedSubscriptionsCount = await DeletedSubscription.countDocuments({
    'subscription.groupPlan': true,
  })

  console.log(
    `## Going to synchronize ${subscriptionsCount} subscriptions and ${deletedSubscriptionsCount} deleted subscriptions`
  )

  await checkActiveSubscriptions()
  await checkDeletedSubscriptions()
}

async function checkActiveSubscriptions() {
  let totalSubscriptionsChecked = 0
  let subscriptions
  const processedSubscriptionIds = new Set()
  do {
    subscriptions = await Subscription.find(
      { groupPlan: true },
      { recurlySubscription_id: 1, member_ids: 1 }
    )
      .sort('_id')
      .skip(totalSubscriptionsChecked)
      .limit(FETCH_LIMIT)
      .lean()

    if (subscriptions.length) {
      const groupIds = subscriptions.map(sub => sub._id)
      const bigQueryGroupMemberships =
        await fetchBigQueryMembershipStatuses(groupIds)
      const membershipsByGroupId = _.groupBy(
        bigQueryGroupMemberships,
        'group_id'
      )

      for (const subscription of subscriptions) {
        const subscriptionId = subscription._id.toString()
        if (!processedSubscriptionIds.has(subscriptionId)) {
          await checkSubscriptionMemberships(
            subscription,
            membershipsByGroupId[subscriptionId] || []
          )
          processedSubscriptionIds.add(subscriptionId)
        }
      }
      totalSubscriptionsChecked += subscriptions.length
    }
  } while (subscriptions.length > 0)
}

async function checkDeletedSubscriptions() {
  let totalDeletedSubscriptionsChecked = 0
  let deletedSubscriptions
  const processedSubscriptionIds = new Set()
  do {
    deletedSubscriptions = (
      await DeletedSubscription.find(
        { 'subscription.groupPlan': true },
        { subscription: 1 }
      )
        .sort('deletedAt')
        .skip(totalDeletedSubscriptionsChecked)
        .limit(FETCH_LIMIT)
    ).map(sub => sub.toObject().subscription)

    if (deletedSubscriptions.length) {
      const groupIds = deletedSubscriptions.map(sub => sub._id.toString())
      const bigQueryGroupMemberships =
        await fetchBigQueryMembershipStatuses(groupIds)

      const membershipsByGroupId = _.groupBy(
        bigQueryGroupMemberships,
        'group_id'
      )

      for (const deletedSubscription of deletedSubscriptions) {
        const subscriptionId = deletedSubscription._id.toString()
        if (!processedSubscriptionIds.has(subscriptionId)) {
          await checkDeletedSubscriptionMemberships(
            deletedSubscription,
            membershipsByGroupId[subscriptionId] || []
          )
          processedSubscriptionIds.add(subscriptionId)
        }
      }
      totalDeletedSubscriptionsChecked += deletedSubscriptions.length
    }
  } while (deletedSubscriptions.length > 0)
}

async function checkSubscriptionMemberships(subscription, membershipStatuses) {
  if (VERBOSE) {
    console.log(
      '\n###########################################################################################',
      '\n# Subscription (mongo): ',
      '\n# _id: \t\t\t\t',
      subscription._id.toString(),
      '\n# member_ids: \t\t\t',
      subscription.member_ids.map(_id => _id.toString()),
      '\n# recurlySubscription_id: \t',
      subscription.recurlySubscription_id
    )
    console.log('#\n# Membership statuses found in BigQuery: ')
    console.table(membershipStatuses)
  }
  // create missing `joined` events when membership status is missing
  for (const memberId of subscription.member_ids) {
    if (
      !_.find(membershipStatuses, {
        user_id: memberId.toString(),
        is_member: true,
      })
    ) {
      await sendCorrectiveEvent(
        memberId,
        'group-subscription-joined',
        subscription
      )
    }
  }
  // create missing `left` events if user is not a member of the group anymore
  for (const { user_id: userId, is_member: isMember } of membershipStatuses) {
    if (
      isMember &&
      !subscription.member_ids.some(id => id.toString() === userId)
    ) {
      await sendCorrectiveEvent(userId, 'group-subscription-left', subscription)
    }
  }
}

async function checkDeletedSubscriptionMemberships(
  subscription,
  membershipStatuses
) {
  if (VERBOSE) {
    console.log(
      '\n###########################################################################################',
      '\n# Deleted subscription (mongo): ',
      '\n# _id: \t\t\t\t',
      subscription._id.toString(),
      '\n# member_ids: \t\t\t',
      subscription.member_ids.map(_id => _id.toString()),
      '\n# recurlySubscription_id: \t',
      subscription.recurlySubscription_id
    )
    console.log('#\n# Membership statuses found in BigQuery: ')
    console.table(membershipStatuses)
  }

  const updatedUserIds = new Set()
  // create missing `left` events if user was a member of the group in BQ and status is not up-to-date
  for (const memberId of subscription.member_ids.map(id => id.toString())) {
    if (
      _.find(membershipStatuses, {
        user_id: memberId,
        is_member: true,
      })
    ) {
      await sendCorrectiveEvent(
        memberId,
        'group-subscription-left',
        subscription
      )
      updatedUserIds.add(memberId)
    }
  }
  // for cases where the user has been removed from the subscription before it was deleted and status is not up-to-date
  for (const { user_id: userId, is_member: isMember } of membershipStatuses) {
    if (isMember && !updatedUserIds.has(userId)) {
      await sendCorrectiveEvent(userId, 'group-subscription-left', subscription)
      updatedUserIds.add(userId)
    }
  }
}

async function sendCorrectiveEvent(userId, event, subscription) {
  if (!ObjectId.isValid(userId)) {
    console.warn(`Skipping '${event}' for user ${userId}: invalid user ID`)
    return
  }
  const segmentation = {
    groupId: subscription._id.toString(),
    subscriptionId: subscription.recurlySubscription_id,
    source: 'sync',
  }
  if (COMMIT) {
    console.log(
      `Sending event '${event}' for user ${userId} with segmentation: ${JSON.stringify(
        segmentation
      )}`
    )
    await AnalyticsManager.recordEventForUser(userId, event, segmentation)
  } else {
    console.log(
      `Dry run - would send event '${event}' for user ${userId} with segmentation: ${JSON.stringify(
        segmentation
      )}`
    )
  }
}

/**
 * @param {Array<ObjectId>} groupIds
 * @return {Promise<*>}
 */
async function fetchBigQueryMembershipStatuses(groupIds) {
  const query = `\
    WITH user_memberships AS (
      SELECT
        group_id,
        COALESCE(user_aliases.user_id, ugm.user_id) AS user_id,
        is_member,
        ugm.created_at
      FROM INT_user_group_memberships ugm
      LEFT JOIN INT_user_aliases user_aliases ON ugm.user_id = user_aliases.analytics_id
      WHERE ugm.group_id IN UNNEST(@groupIds)
    ),
    ordered_status AS (
      SELECT *,
        ROW_NUMBER() OVER(PARTITION BY group_id, user_id ORDER BY created_at DESC) AS row_number
        FROM user_memberships
    )
    SELECT group_id, user_id, is_member, created_at FROM ordered_status
    WHERE row_number = 1;
  `

  return await GoogleBigQueryHelper.query(query, {
    groupIds: groupIds.map(id => id.toString()),
  })
}

const setup = () => {
  const argv = minimist(process.argv.slice(2))
  FETCH_LIMIT = argv.fetch ? argv.fetch : 100
  COMMIT = argv.commit !== undefined
  VERBOSE = argv.debug !== undefined
  if (!COMMIT) {
    console.warn('Doing dry run without --commit')
  }
  if (VERBOSE) {
    console.log('Running in verbose mode')
  }
}

setup()
try {
  await main()
  console.error('Done.')
  process.exit(0)
} catch (error) {
  console.error({ error })
  process.exit(1)
}

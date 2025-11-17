import { Subscription } from '../../app/src/models/Subscription.mjs'
import RecurlyWrapper from '../../app/src/Features/Subscription/RecurlyWrapper.mjs'
import SubscriptionUpdater from '../../app/src/Features/Subscription/SubscriptionUpdater.mjs'
import minimist from 'minimist'
import { setTimeout } from 'node:timers/promises'
import util from 'node:util'

util.inspect.defaultOptions.maxArrayLength = null

const handleSyncSubscriptionError = async (subscription, error) => {
  console.warn(`Errors with subscription id=${subscription._id}:`, error)

  if (typeof error === 'string' && error.match(/429$/)) {
    console.warn('Recurly rate limit hit (429). Waiting for 5 minutes...')
    await setTimeout(1000 * 60 * 5)
    return
  }
  if (typeof error === 'string' && error.match(/5\d\d$/)) {
    console.warn('Recurly server error (5xx). Retrying in 1 minute...')
    await setTimeout(1000 * 60)
    await syncRecurlyStateInSubscription(subscription)
    return
  }
  await setTimeout(80)
}

const syncRecurlyStateInSubscription = async subscription => {
  let recurlySubscription

  try {
    recurlySubscription = await RecurlyWrapper.promises.getSubscription(
      subscription.recurlySubscription_id
    )
  } catch (error) {
    await handleSyncSubscriptionError(subscription, error)
    return
  }

  if (!subscription.recurlyStatus) {
    subscription.recurlyStatus = {}
  }

  if (subscription.recurlyStatus.state !== recurlySubscription.state) {
    console.log(
      `Mismatched recurlyStatus.state for subscription ID ${subscription._id}. ` +
        `Our database: '${subscription.recurlyStatus.state || 'undefined/null'}', recurly: '${recurlySubscription.state}'.`
    )

    subscription.recurlyStatus.state = recurlySubscription.state

    if (COMMIT) {
      try {
        console.log(
          `Committing update for subscription ID: ${subscription._id}`
        )
        await SubscriptionUpdater.promises.updateSubscriptionFromRecurly(
          recurlySubscription,
          subscription,
          {}
        )
      } catch (error) {
        await handleSyncSubscriptionError(subscription, error)
      }

      console.log(
        `Successfully updated subscription ID ${subscription._id} with new recurlyStatus.state: ${subscription.recurlyStatus.state}`
      )
    }
  } else {
    console.log(
      `Subscription ID ${subscription._id}: recurlyStatus.state is already in sync.`
    )
  }

  await setTimeout(80)
}

let COMMIT, SUBSCRIPTION_ID

const setup = () => {
  const argv = minimist(process.argv.slice(2))

  SUBSCRIPTION_ID = argv.subscriptionId
  if (!SUBSCRIPTION_ID) {
    console.error(
      'Error: Please provide a subscription ID using --subscriptionId=<id>'
    )
    process.exit(1)
  }
  console.log(
    `Attempting to sync subscription.recurlyStatus with ID: ${SUBSCRIPTION_ID}`
  )

  COMMIT = argv.commit !== undefined
  if (!COMMIT) {
    console.warn(
      'Doing dry run without --commit. No database changes will be made.'
    )
  }
}

const run = async () => {
  try {
    const subscription = await Subscription.findById(SUBSCRIPTION_ID).exec()

    if (!subscription) {
      console.error(
        `Error: Subscription with ID ${SUBSCRIPTION_ID} not found in the database.`
      )
      process.exit(1)
    }

    if (!subscription.recurlySubscription_id) {
      console.error(
        `Error: Subscription ID ${SUBSCRIPTION_ID} does not have a Recurly subscription ID.`
      )
      process.exit(1)
    }

    console.log(
      `Found subscription: ${subscription._id}, Recurly ID: ${subscription.recurlySubscription_id}`
    )

    await syncRecurlyStateInSubscription(subscription)

    console.log('DONE')
  } catch (error) {
    console.error('An unhandled error occurred during script execution:', error)
    process.exit(1)
  }
}

setup()

await run()

process.exit(0)

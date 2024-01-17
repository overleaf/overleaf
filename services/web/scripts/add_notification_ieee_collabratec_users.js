const NotificationsBuilder = require('../app/src/Features/Notifications/NotificationsBuilder')
const { waitForDb } = require('../app/src/infrastructure/mongodb')
const { Subscription } = require('../app/src/models/Subscription')
const minimist = require('minimist')

let COMMIT = false

async function main() {
  await waitForDb()
  const subscription = await Subscription.findOne({
    teamName: 'IEEECollabratec',
  })

  if (!subscription) {
    console.error(`No IEEECollabratec group subscription found so quitting`)
    return
  }

  const userIds = subscription.member_ids

  console.log(`Found ${userIds.length} users in IEEECollabratec group`)

  if (!COMMIT) {
    console.log('Dry run enabled, quitting here')
    return
  }

  if (userIds.length > 0) {
    console.log(`Notifying ${userIds.length} users`)

    for (const id of userIds) {
      await NotificationsBuilder.promises
        .ieeeCollabratecRetirement(id.toString())
        .create()
    }

    console.log(
      `Notification successfully added/updated for ${userIds.length} users`
    )
  } else {
    console.log('No users found')
  }
}

const setup = () => {
  const argv = minimist(process.argv.slice(2))
  COMMIT = argv.commit !== undefined
  if (!COMMIT) {
    console.warn('Doing dry run. Add --commit to commit changes')
  }
}

setup()

main()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

const path = require('path')
const fs = require('fs')
const NotificationsBuilder = require('../app/src/Features/Notifications/NotificationsBuilder')
const { waitForDb } = require('../app/src/infrastructure/mongodb')
const { Subscription } = require('../app/src/models/Subscription')
const minimist = require('minimist')
const { db } = require('../app/src/infrastructure/mongodb')
const { promiseMapWithLimit } = require('@overleaf/promise-utils')

/**
 * This script is used to notify some users in the IEEECollabratec group that
 * they will lose access to Overleaf.
 *
 * Parameters:
 *  --filename: the filename of the JSON file containing emails of users that
 *              should **not** be notified.
 *  --commit: if present, the script will commit the changes to the database.
 *
 * Usage:
 *   - dry run:
 *     node add_notification_ieee_collabratec_users.js --filename=emails.json
 *   - commit:
 *     node add_notification_ieee_collabratec_users.js --filename=emails.json --commit
 */

let COMMIT = false
let EMAILS_FILENAME

/**
 * The IEEE have provided us with a list of active users that should not be removed
 * (and therefore not notified). This method retrives those users.
 */
function getActiveUserEmails(filename) {
  const data = fs.readFileSync(path.join(__dirname, filename), 'utf8')
  const emailsArray = JSON.parse(data)
  const emailsSet = new Set(emailsArray)
  console.log(
    `Read ${emailsSet.size} (${emailsArray.length} in array) emails from ${filename}`
  )
  return emailsSet
}

async function getIEEEUsers() {
  return await db.subscriptions
    .aggregate([
      { $match: { teamName: 'IEEECollabratec' } },
      { $unwind: '$member_ids' },
      {
        $lookup: {
          from: 'users',
          localField: 'member_ids',
          foreignField: '_id',
          as: 'member_details',
        },
      },
      {
        $project: {
          _id: 1,
          teamName: 1,
          'member_details._id': 1,
          'member_details.email': 1,
          'member_details.emails.email': 1,
        },
      },
    ])
    .toArray()
}

async function main() {
  const start = performance.now()

  if (!EMAILS_FILENAME) {
    throw new Error('No email filename provided')
  }

  await waitForDb()
  const subscription = await Subscription.findOne({
    teamName: 'IEEECollabratec',
  })

  if (!subscription) {
    console.error(`No IEEECollabratec group subscription found so quitting`)
    return
  }

  // First we remove all existing Collabratec retirement notifications
  if (COMMIT) {
    await NotificationsBuilder.promises
      .ieeeCollabratecRetirement()
      .deleteAllUnread()
  }

  let totalUsers = 0
  let totalUsersNotified = 0

  const usersArray = await getIEEEUsers()
  const activeUsers = getActiveUserEmails(EMAILS_FILENAME)

  const activeUsersFound = new Set()

  // Then go through each collabratec user to see if we need to notify them
  await promiseMapWithLimit(10, usersArray, async member => {
    if (totalUsers % 5000 === 0)
      console.log(
        `notified: ${totalUsersNotified} - progress: ${totalUsers} / ${usersArray.length}`
      )

    totalUsers = totalUsers + 1

    const userDetails = member.member_details[0]

    for (const email of userDetails.emails) {
      if (activeUsers.has(email.email)) {
        activeUsersFound.add(email.email)
        return
      }
    }

    if (COMMIT) {
      await NotificationsBuilder.promises
        .ieeeCollabratecRetirement(userDetails._id.toString())
        .create()
    }

    totalUsersNotified += 1
  })

  console.log(`Found ${totalUsers} users in IEEECollabratec group`)

  console.log(
    `Found ${totalUsersNotified} users in IEEECollabratec group to notify`
  )

  console.log(`Found ${activeUsersFound.size} active users`)

  const activeUsersNotFound = Array.from(activeUsers).filter(
    user => !activeUsersFound.has(user)
  )

  console.log(`${activeUsersNotFound.length} IEEE active users not found:`)
  console.log(activeUsersNotFound)

  const end = performance.now()
  console.log(`Took ${end - start} ms`)
}

const setup = () => {
  const argv = minimist(process.argv.slice(2))
  COMMIT = argv.commit !== undefined
  EMAILS_FILENAME = argv.filename
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

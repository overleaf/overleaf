const path = require('path')
const fs = require('fs')
const AnalyticsManager = require('../app/src/Features/Analytics/AnalyticsManager')
const { waitForDb } = require('../app/src/infrastructure/mongodb')
const { Subscription } = require('../app/src/models/Subscription')
const minimist = require('minimist')
const { db } = require('../app/src/infrastructure/mongodb')
const { promiseMapWithLimit } = require('@overleaf/promise-utils')
const _ = require('lodash')

/**
 * This script is used to remove some users from the IEEEPublications group.
 *
 * Parameters:
 *  --filename: the filename of the JSON file containing emails of users that
 *              should **not** be removed
 *  --commit: if present, the script will commit the changes to the database.
 *
 * Usage:
 *   - dry run:
 *     node scripts/remove_unwanted_ieee_collabratec_users.js --filename=emails-to-keep.json
 *   - commit:
 *     node scripts/remove_unwanted_ieee_collabratec_users.js --filename=emails-to-keep.json --commit
 */

let COMMIT = false
let EMAILS_FILENAME

/**
 * The IEEE have provided us with a list of active users that should not be removed
 * This method retrieves those users.
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
  const results = await db.subscriptions
    .aggregate([
      { $match: { teamName: 'IEEEPublications' } },
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

  return results
    .map(subscription => subscription.member_details[0])
    .filter(Boolean)
}

async function main() {
  const start = performance.now()

  if (!EMAILS_FILENAME) {
    throw new Error('No email filename provided')
  }

  await waitForDb()
  const subscription = await Subscription.findOne({
    teamName: 'IEEEPublications',
  })

  if (!subscription) {
    console.error(`No IEEEPublications group subscription found so quitting`)
    return
  }

  /**
   * @type {string[]}
   */
  const oldMemberIds = subscription.member_ids.map(id => id.toString())

  console.log(
    `Found ${oldMemberIds.length} members_ids in IEEEPublications group`
  )

  const usersArray = await getIEEEUsers()
  console.log(
    `Found ${usersArray.length} users in IEEEPublications group. (${oldMemberIds.length - usersArray.length} missing)`
  )

  const activeUsers = getActiveUserEmails(EMAILS_FILENAME)

  const activeUsersFound = new Set()

  /**
   * @type {string[]}
   */
  const memberIdsToRemove = []

  let index = 0

  // Then go through each collabratec user to see if we need to remove them
  await promiseMapWithLimit(10, usersArray, async userDetails => {
    if (index % 1000 === 0)
      console.log(
        `progress: ${index} / ${usersArray.length} (${memberIdsToRemove.length} to remove)`
      )

    index = index + 1

    if (COMMIT) {
      await AnalyticsManager.setUserPropertyForUser(
        userDetails._id.toString(),
        'ieee-retirement',
        true
      )
    }

    for (const email of userDetails.emails) {
      if (activeUsers.has(email.email)) {
        activeUsersFound.add(email.email)
        return
      }
    }

    memberIdsToRemove.push(userDetails._id.toString())
  })

  console.log(`Found ${memberIdsToRemove.length} users to remove`)

  /**
   * @type {string[]}
   */
  const memberIdsToKeep = _.difference(oldMemberIds, memberIdsToRemove)

  console.log(`Keeping ${memberIdsToKeep.length} users`)

  if (COMMIT) {
    await Subscription.updateOne(
      { teamName: 'IEEEPublications' },
      { member_ids: memberIdsToKeep }
    )
  }

  console.log(`Found ${activeUsersFound.size} active users`)

  const activeUsersNotFound = Array.from(activeUsers).filter(
    user => !activeUsersFound.has(user)
  )

  console.log(`${activeUsersNotFound.length} IEEE active users not found:`)
  console.log(activeUsersNotFound)

  const subscriptionAfter = await Subscription.findOne({
    teamName: 'IEEEPublications',
  })
  console.log(
    `There are now ${subscriptionAfter?.member_ids?.length} members_ids in IEEEPublications group`
  )

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

// @ts-check

import fs from 'node:fs'
import minimist from 'minimist'
import {
  db,
  READ_PREFERENCE_SECONDARY,
} from '../../app/src/infrastructure/mongodb.js'

/**
 * @import { ObjectId } from 'mongodb-legacy'
 */

const OPTS = parseArgs()

const expectedManualRecurlyIds = readFile(OPTS.filename)
const idsToSetToManual = await getSubscriptionIdsToSetToManual(
  expectedManualRecurlyIds
)
const idsToSetToAutomatic = await getSubscriptionIdsToSetToAutomatic(
  expectedManualRecurlyIds
)

if (idsToSetToManual.length > 0) {
  if (OPTS.commit) {
    console.log(
      `Setting ${idsToSetToManual.length} subscriptions to manual invoice collection...`
    )
    await setCollectionMethod(idsToSetToManual, 'manual')
  } else {
    console.log(
      `Would set ${idsToSetToManual.length} subscriptions to manual invoice collection`
    )
  }
}

if (idsToSetToAutomatic.length > 0) {
  if (OPTS.commit) {
    console.log(
      `Setting ${idsToSetToAutomatic.length} subscriptions to automatic invoice collection...`
    )
    await setCollectionMethod(idsToSetToAutomatic, 'automatic')
  } else {
    console.log(
      `Would set ${idsToSetToAutomatic.length} subscriptions to automatic invoice collection`
    )
  }
}

if (!OPTS.commit) {
  console.log('This was a dry run. Add the --commit option to apply changes')
}

process.exit(0)

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    boolean: ['commit'],
  })
  if (args._.length !== 1) {
    usage()
    process.exit(1)
  }
  return {
    filename: args._[0],
    commit: args.commit,
  }
}

function usage() {
  console.log(`Usage: node set_manually_collected_subscriptions.mjs FILE [--commit]

    where FILE contains the list of subscription ids that are manually collected`)
}

function readFile(filename) {
  const contents = fs.readFileSync(filename, { encoding: 'utf-8' })
  const subscriptionIds = contents.split('\n').filter(id => id.length > 0)
  return subscriptionIds
}

/**
 * Get the ids of subscriptions that need to have their collection method set to
 * manual
 *
 * @param {string[]} expectedManualRecurlyIds
 * @return {Promise<ObjectId[]>}
 */
async function getSubscriptionIdsToSetToManual(expectedManualRecurlyIds) {
  const ids = await db.subscriptions
    .find(
      {
        recurlySubscription_id: { $in: expectedManualRecurlyIds },
        collectionMethod: { $ne: 'manual' },
      },
      { projection: { _id: 1 }, readPreference: READ_PREFERENCE_SECONDARY }
    )
    .map(record => record._id)
    .toArray()
  return ids
}

/**
 * Get the ids of subscriptions that need to have their collection method set to
 * automatic
 *
 * @param {string[]} expectedManualRecurlyIds
 * @return {Promise<ObjectId[]>}
 */
async function getSubscriptionIdsToSetToAutomatic(expectedManualRecurlyIds) {
  const ids = await db.subscriptions
    .find(
      {
        recurlySubscription_id: { $nin: expectedManualRecurlyIds },
        collectionMethod: 'manual',
      },
      { projection: { _id: 1 }, readPreference: READ_PREFERENCE_SECONDARY }
    )
    .map(record => record._id)
    .toArray()
  return ids
}

/**
 * Set the collection method for the given subscriptions
 *
 * @param {ObjectId[]} subscriptionIds
 * @param {"automatic" | "manual"} collectionMethod
 */
async function setCollectionMethod(subscriptionIds, collectionMethod) {
  await db.subscriptions.updateMany(
    { _id: { $in: subscriptionIds } },
    { $set: { collectionMethod } }
  )
}

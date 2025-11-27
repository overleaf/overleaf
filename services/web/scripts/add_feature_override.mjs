// Script to add feature overrides
//
// A feature override is appended to the user's featuresOverride list if they do
// not already have the feature. The features are refreshed after adding the
// override.
//
// If the script detects that the user would have the feature just by refreshing
// then it skips adding the override and just refreshes the users features --
// this is to minimise the creation of unnecessary overrides.
//
// Usage:
//
// $ node scripts/add_feature_override.mjs --commit --note 'text description' --expires 2022-01-01 --override JSONFILE --ids IDFILE
//
// --commit   do the update, remove this option for dry-run testing
// --note     text description [optional]
// --expires  expiry date for override [optional]
// --skip-existing   don't create the override for users who already have the feature (e.g. via a subscription)
//
// IDFILE: file containing list of user ids, one per line
// JSONFILE:  file containing JSON of the desired feature overrides e.g. {"symbolPalette": true}
//
// The feature override is specified with JSON to allow types to be set as string/number/boolean.
// It is contained in a file to avoid any issues with shell quoting.

import minimist from 'minimist'

import fs from 'node:fs'
import { ObjectId } from '../app/src/infrastructure/mongodb.mjs'
import pLimit from 'p-limit'
import FeaturesUpdater from '../app/src/Features/Subscription/FeaturesUpdater.mjs'
import FeaturesHelper from '../app/src/Features/Subscription/FeaturesHelper.mjs'
import UserFeaturesUpdater from '../app/src/Features/Subscription/UserFeaturesUpdater.mjs'
import UserGetter from '../app/src/Features/User/UserGetter.mjs'

const processLogger = {
  failed: [],
  success: [],
  skipped: [],
  printSummary: () => {
    console.log(
      {
        success: processLogger.success,
        failed: processLogger.failed,
        skipped: processLogger.skipped,
      },
      `\nDONE. ${processLogger.success.length} successful. ${processLogger.skipped.length} skipped. ${processLogger.failed.length} failed to update.`
    )
  },
}

function _validateUserIdList(userIds) {
  userIds.forEach(userId => {
    if (!ObjectId.isValid(userId))
      throw new Error(`user ID not valid: ${userId}`)
  })
}

async function _handleUser(userId) {
  console.log('updating user', userId)
  const user = await UserGetter.promises.getUser(userId, {
    features: 1,
    featuresOverrides: 1,
  })
  if (!user) {
    console.log(userId, 'does not exist, failed')
    processLogger.failed.push(userId)
    return
  }
  const desiredFeatures = OVERRIDE.features
  // Does the user have the requested features already?
  if (
    SKIP_EXISTING &&
    FeaturesHelper.isFeatureSetBetter(user.features, desiredFeatures)
  ) {
    console.log(
      userId,
      `already has ${JSON.stringify(desiredFeatures)}, skipping`
    )
    processLogger.skipped.push(userId)
    return
  }
  // Would the user have the requested feature if the features were refreshed?
  const freshFeatures = await FeaturesUpdater.promises.computeFeatures(userId)
  if (
    SKIP_EXISTING &&
    FeaturesHelper.isFeatureSetBetter(freshFeatures, desiredFeatures)
  ) {
    console.log(
      userId,
      `would have ${JSON.stringify(
        desiredFeatures
      )} if refreshed, skipping override`
    )
  } else {
    // create the override (if not in dry-run mode)
    if (COMMIT) {
      await UserFeaturesUpdater.promises.createFeaturesOverride(
        userId,
        OVERRIDE
      )
    }
  }
  if (!COMMIT) {
    // not saving features; nothing else to do
    return
  }
  const refreshResult = await FeaturesUpdater.promises.refreshFeatures(
    userId,
    'add-feature-override-script'
  )
  const featureSetIncludesNewFeatures = FeaturesHelper.isFeatureSetBetter(
    refreshResult.features,
    desiredFeatures
  )
  if (featureSetIncludesNewFeatures) {
    // features added successfully
    processLogger.success.push(userId)
  } else {
    console.log('FEATURE NOT ADDED', refreshResult)
    processLogger.failed.push(userId)
  }
}

const argv = minimist(process.argv.slice(2))
const CONCURRENCY = argv.async ? argv.async : 10
const overridesFilename = argv.override
const expires = argv.expires
const note = argv.note
const SKIP_EXISTING = argv['skip-existing'] || false
const COMMIT = argv.commit !== undefined
if (!COMMIT) {
  console.warn('Doing dry run without --commit')
}

const idsFilename = argv.ids
if (!idsFilename) throw new Error('missing ids list filename')

const usersFile = fs.readFileSync(idsFilename, 'utf8')
const userIds = usersFile
  .trim()
  .split('\n')
  .map(id => id.trim())

const overridesFile = fs.readFileSync(overridesFilename, 'utf8')
const features = JSON.parse(overridesFile)
const OVERRIDE = { features }
if (note) {
  OVERRIDE.note = note
}
if (expires) {
  OVERRIDE.expiresAt = new Date(expires)
}

async function processUsers(userIds) {
  console.log('---Starting add feature override script---')

  console.log('Will update users to have', OVERRIDE)
  console.log(
    SKIP_EXISTING
      ? 'Users with this feature already will be skipped'
      : 'Every user in file will get feature override'
  )

  _validateUserIdList(userIds)
  console.log(`---Starting to process ${userIds.length} users---`)

  const limit = pLimit(CONCURRENCY)
  const results = await Promise.allSettled(
    userIds.map(userId => limit(() => _handleUser(new ObjectId(userId))))
  )
  results.forEach((result, idx) => {
    if (result.status !== 'fulfilled') {
      console.log(userIds[idx], 'failed', result.reason)
      processLogger.failed.push(userIds[idx])
    }
  })
  processLogger.printSummary()
  process.exit()
}

await processUsers(userIds)

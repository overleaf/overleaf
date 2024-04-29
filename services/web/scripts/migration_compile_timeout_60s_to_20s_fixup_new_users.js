#!/usr/bin/env node

const minimist = require('minimist')
const {
  db,
  READ_PREFERENCE_SECONDARY,
  waitForDb,
} = require('../app/src/infrastructure/mongodb')
const { batchedUpdate } = require('./helpers/batchedUpdate')

// A few seconds after the previous migration script was run
const FEATURES_UPDATED_AT = new Date('2024-04-16T12:41:00Z')

const query = {
  'features.compileTimeout': 20,
  featuresUpdatedAt: FEATURES_UPDATED_AT,
  signUpDate: { $gt: FEATURES_UPDATED_AT },
}

async function logCount() {
  const usersToUpdate = await db.users.countDocuments(query, {
    readPreference: READ_PREFERENCE_SECONDARY,
  })
  console.log(
    `Found ${usersToUpdate} users needing their featuresUpdatedAt removed`
  )
}

const main = async ({ COMMIT, SKIP_COUNT }) => {
  console.time('Script Duration')

  await waitForDb()

  if (!SKIP_COUNT) {
    await logCount()
  }

  if (COMMIT) {
    const nModified = await batchedUpdate('users', query, {
      $unset: { featuresUpdatedAt: 1 },
    })
    console.log(`Updated ${nModified} records`)
  }

  console.timeEnd('Script Duration')
}

const setup = () => {
  const argv = minimist(process.argv.slice(2))
  const COMMIT = argv.commit !== undefined
  const SKIP_COUNT = argv['skip-count'] !== undefined
  if (!COMMIT) {
    console.warn('Doing dry run. Add --commit to commit changes')
  }
  return { COMMIT, SKIP_COUNT }
}

main(setup())
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .then(() => process.exit(0))

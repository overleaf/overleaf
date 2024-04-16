#!/usr/bin/env node

const minimist = require('minimist')
const {
  db,
  READ_PREFERENCE_SECONDARY,
  waitForDb,
} = require('../app/src/infrastructure/mongodb')
const { batchedUpdate } = require('./helpers/batchedUpdate')

async function logCount() {
  const count60s = await db.users.countDocuments(
    { 'features.compileTimeout': { $lte: 60, $ne: 20 } },
    { readPreference: READ_PREFERENCE_SECONDARY }
  )
  console.log(`Found ${count60s} users with compileTimeout <= 60s && != 20s`)
  const count20s = await db.users.countDocuments(
    { 'features.compileTimeout': 20 },
    { readPreference: READ_PREFERENCE_SECONDARY }
  )
  console.log(`Found ${count20s} users with compileTimeout == 20s`)
}

const main = async ({ COMMIT, SKIP_COUNT }) => {
  console.time('Script Duration')

  await waitForDb()

  if (!SKIP_COUNT) {
    await logCount()
  }

  if (COMMIT) {
    const nModified = await batchedUpdate(
      'users',
      { 'features.compileTimeout': { $lte: 60, $ne: 20 } },
      { $set: { 'features.compileTimeout': 20 } }
    )
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

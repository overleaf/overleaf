import {
  db,
  READ_PREFERENCE_SECONDARY,
} from '../app/src/infrastructure/mongodb.js'
import parseArgs from 'minimist'

async function _removeFeatureFromAllUsers(feature, commit) {
  let removals = 0
  const query = {}
  query[`features.${feature}`] = true
  const usersWithFeature = db.users.find(query, {
    readPreference: READ_PREFERENCE_SECONDARY,
  })

  const update = {}
  update[`features.${feature}`] = false
  while (await usersWithFeature.hasNext()) {
    const user = await usersWithFeature.next()
    if (commit) {
      await db.users.findOneAndUpdate({ _id: user._id }, { $set: update })
    }
    removals++
  }
  console.log(`removed ${feature} from ${removals} users`)
  if (!commit) {
    console.log(
      'this was a dry run, pass --commit to remove features from users'
    )
  }
}

async function main() {
  const argv = parseArgs(process.argv.slice(2), {
    string: ['feature'],
    boolean: ['commit'],
    unknown: function (arg) {
      console.error('unrecognised argument', arg)
      process.exit(1)
    },
  })
  const feature = argv.feature
  const commit = argv.commit || false
  await _removeFeatureFromAllUsers(feature, commit)
}

try {
  await main()
  console.log('Done')
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}

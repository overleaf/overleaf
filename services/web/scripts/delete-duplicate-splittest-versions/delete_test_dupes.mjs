import { db } from '../../app/src/infrastructure/mongodb.js'
import minimist from 'minimist'

const argv = minimist(process.argv.slice(2))
const commit = argv.commit !== undefined

if (!commit) {
  console.log('DOING DRY RUN. TO SAVE CHANGES PASS --commit')
}

async function getDupes(commit) {
  const entries = await db.splittests.aggregate([
    {
      $match: {
        archived: { $eq: true },
      },
    },
    { $unwind: '$versions' },
    {
      $group: {
        // Group by fields to match on (a,b)
        _id: {
          _id: '$_id',
          name: '$name',
          creationDate: '$version.creationDate',
        },

        // Count number of matching docs for the group
        count: { $sum: 1 },

        // Save the _id for matching docs
        docs: { $push: '$_id' },
      },
    },

    // Limit results to duplicates (more than 1 match)
    {
      $match: {
        count: { $gt: 1 },
      },
    },
  ])

  let entry
  const removed = []
  while ((entry = await entries.next())) {
    const name = entry._id.name
    const test = await db.splittests.findOne({ name })

    if (hasArchiveDupe(test.versions)) {
      removed.push(test.name)
      removeLastVersion(test, commit)
    }
  }
  const message = commit
    ? `removed dupes from ${removed.length} feature flags`
    : `planning to remove dupes from ${removed.length} feature flags`
  console.info(message, removed)

  console.log('DONE')
  process.exit()
}

function hasArchiveDupe(versions) {
  const last = versions.length - 1
  // guard in case we somehow get smthn with only one version here flagged as having a dupe
  if (last < 2) return false
  // need to string compare dates, as otherwise will compare the isoDate objects (diff objs so not equal)
  return (
    versions[last].createdAt.toString() ===
    versions[last - 1].createdAt.toString()
  )
}

function removeLastVersion(test, commit) {
  const name = test.name
  const numVersions = test.versions.length

  if (name && numVersions > 1) {
    const lastVersion = test.versions[numVersions - 1].versionNumber
    console.log(`removing test ${test.name} version ${lastVersion}`)
    if (commit) {
      db.splittests.updateOne(
        { name },
        { $pull: { versions: { versionNumber: lastVersion } } }
      )
    }
  }
}

getDupes(commit)

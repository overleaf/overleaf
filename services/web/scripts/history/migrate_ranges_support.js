const HistoryRangesSupportMigration = require('../../app/src/Features/History/HistoryRangesSupportMigration')
const { waitForDb } = require('../../app/src/infrastructure/mongodb')
const minimist = require('minimist')

async function main() {
  await waitForDb()
  const { projectId, direction } = parseArgs()
  await HistoryRangesSupportMigration.promises.migrateProject(
    projectId,
    direction
  )
}

function usage() {
  console.log('Usage: migrate_ranges_support.js PROJECT_ID [--backwards]')
}

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    boolean: ['backwards'],
  })

  if (args._.length !== 1) {
    usage()
    process.exit(1)
  }

  return {
    direction: args.backwards ? 'backwards' : 'forwards',
    projectId: args._[0],
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

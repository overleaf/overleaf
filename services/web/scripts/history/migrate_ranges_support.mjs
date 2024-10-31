import HistoryRangesSupportMigration from '../../app/src/Features/History/HistoryRangesSupportMigration.mjs'
import minimist from 'minimist'

async function main() {
  const {
    projectIds,
    ownerIds,
    minId,
    maxId,
    maxCount,
    direction,
    force,
    stopOnError,
    quickOnly,
    concurrency,
  } = parseArgs()
  await HistoryRangesSupportMigration.promises.migrateProjects({
    projectIds,
    ownerIds,
    minId,
    maxId,
    maxCount,
    direction,
    force,
    stopOnError,
    quickOnly,
    concurrency,
  })
}

function usage() {
  console.error(`Usage: migrate_ranges_support.mjs [OPTIONS]

Options:

    --help           Print this help
    --owner-id       Migrate all projects owned by this owner
    --project-id     Migrate this project
    --min-id         Migrate projects from this id
    --max-id         Migrate projects to this id
    --max-count      Migrate at most this number of projects
    --all            Migrate all projects
    --backwards      Disable history ranges support for selected project ids
    --force          Migrate projects even if they were already migrated
    --stop-on-error  Stop after first migration error
    --quick-only     Do not try a resync migration if quick migration fails
    --concurrency    How many jobs to run in parallel
`)
}

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    boolean: ['backwards', 'help', 'all', 'force', 'quick-only'],
    string: ['owner-id', 'project-id', 'min-id', 'max-id'],
  })

  if (args.help) {
    usage()
    process.exit(0)
  }

  const direction = args.backwards ? 'backwards' : 'forwards'
  const ownerIds = arrayOpt(args['owner-id'])
  const projectIds = arrayOpt(args['project-id'])
  const minId = args['min-id']
  const maxId = args['max-id']
  const maxCount = args['max-count']
  const force = args.force
  const stopOnError = args['stop-on-error']
  const quickOnly = args['quick-only']
  const concurrency = args.concurrency ?? 1
  const all = args.all

  if (
    !all &&
    ownerIds == null &&
    projectIds == null &&
    minId == null &&
    maxId == null &&
    maxCount == null
  ) {
    console.error(
      'Please specify at least one filter, or --all to process all projects\n'
    )
    usage()
    process.exit(1)
  }

  return {
    ownerIds,
    projectIds,
    minId,
    maxId,
    maxCount,
    direction,
    force,
    stopOnError,
    quickOnly,
    concurrency,
  }
}

function arrayOpt(value) {
  if (typeof value === 'string') {
    return [value]
  } else if (Array.isArray(value)) {
    return value
  } else {
    return undefined
  }
}

try {
  await main()
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}

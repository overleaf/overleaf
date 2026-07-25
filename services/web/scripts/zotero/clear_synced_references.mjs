// @ts-check
import minimist from 'minimist'
import logger from '@overleaf/logger'
import { db, ObjectId } from '../../app/src/infrastructure/mongodb.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

// Only zotero is wired up today; the flag exists so the script generalises to
// other reference providers without a rewrite.
const SUPPORTED_SOURCES = ['zotero']

const argv = minimist(process.argv.slice(2), {
  boolean: ['commit', 'keep-sync-state', 'help'],
  string: ['user-id', 'source'],
  default: { source: 'zotero' },
})

function usage() {
  logger.info(
    {},
    `Usage: node scripts/zotero/clear_synced_references.mjs --user-id <id> [options]

Resets a user's reference-sync state for local debugging. Deletes every
libraryReferences entry linked to the given source (sources.<source> present)
and removes the user's librarySyncStates rows for that provider.

Options:
  --user-id <id>     Required. The Overleaf user _id to reset.
  --source <name>    Reference source to clear (default: zotero).
                     Supported: ${SUPPORTED_SOURCES.join(', ')}.
  --commit           Apply changes. Without this, runs as a dry run.
  --keep-sync-state  Only delete the references; leave the
                     librarySyncStates rows untouched.
`
  )
}

if (argv.help || !argv['user-id']) {
  usage()
  process.exit(argv.help ? 0 : 1)
}

const source = argv.source
if (!SUPPORTED_SOURCES.includes(source)) {
  logger.error(
    { source },
    `unsupported source; expected one of ${SUPPORTED_SOURCES.join(', ')}`
  )
  process.exit(1)
}

const userId = new ObjectId(argv['user-id'])

/** @param {(message: string) => Promise<void>} trackProgress */
async function main(trackProgress) {
  if (!argv.commit) {
    await trackProgress('DRY RUN. Pass --commit to apply changes.')
  }

  const refFilter = { userId, [`sources.${source}`]: { $exists: true } }
  const refCount = await db.libraryReferences.countDocuments(refFilter)
  if (argv.commit) {
    const result = await db.libraryReferences.deleteMany(refFilter)
    await trackProgress(
      `deleted ${result.deletedCount} ${source}-linked references`
    )
  } else {
    await trackProgress(
      `[dry-run] would delete ${refCount} ${source}-linked references`
    )
  }

  if (argv['keep-sync-state']) {
    return
  }

  const stateFilter = { userId, provider: source }
  if (argv.commit) {
    const result = await db.librarySyncStates.deleteMany(stateFilter)
    await trackProgress(
      `deleted ${result.deletedCount} librarySyncStates row(s)`
    )
  } else {
    const stateCount = await db.librarySyncStates.countDocuments(stateFilter)
    await trackProgress(
      `[dry-run] would delete ${stateCount} librarySyncStates row(s)`
    )
  }
}

try {
  await scriptRunner(main, {
    userId: argv['user-id'],
    source,
    commit: Boolean(argv.commit),
    keepSyncState: Boolean(argv['keep-sync-state']),
  })
  process.exit(0)
} catch (err) {
  logger.error({ err }, 'clear_synced_references failed')
  process.exit(1)
}

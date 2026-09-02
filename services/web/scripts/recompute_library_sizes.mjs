// @ts-check
import minimist from 'minimist'
import logger from '@overleaf/logger'
import { db } from '../app/src/infrastructure/mongodb.mjs'
import { recomputeUserLibrary } from '../modules/library/app/src/LibrarySizeManager.mts'
import { scriptRunner } from './lib/ScriptRunner.mjs'

const argv = minimist(process.argv.slice(2), {
  boolean: ['commit', 'help'],
})

function usage() {
  logger.info(
    {},
    `Usage: node recompute_library_sizes.mjs [options]

Recomputes the committed referenceCount/sizeBytes totals in librarySizes from
the source-of-truth aggregate over libraryReferences, for every user that
already has a librarySizes document. Clears any stale reservations. Safe to
rerun; heals drift left by a crashed write (e.g. a crash between insertMany
and committing a reservation).

Users with no librarySizes document yet don't need attention here: one is
created automatically, correctly, the first time it's needed.

Options:
  --commit   Apply changes. Without this, runs as a dry run.
`
  )
}

if (argv.help) {
  usage()
  process.exit(0)
}

/** @param {(message: string) => Promise<void>} trackProgress */
async function main(trackProgress) {
  if (!argv.commit) {
    await trackProgress('DRY RUN. Pass --commit to apply changes.')
  }

  const cursor = db.librarySizes.find({}, { projection: { _id: 1 } })

  let processed = 0
  for await (const { _id } of cursor) {
    const userId = _id.toString()
    if (argv.commit) {
      await recomputeUserLibrary(userId)
    }
    processed += 1
    if (processed % 10_000 === 0) {
      await trackProgress(
        `${argv.commit ? 'recomputed' : '[dry-run]'} ${processed} users`
      )
    }
  }
  await trackProgress(
    `done; ${argv.commit ? 'recomputed' : 'would recompute'} ${processed} users`
  )
}

try {
  await scriptRunner(main, { commit: Boolean(argv.commit) })
  process.exit(0)
} catch (err) {
  logger.error({ err }, 'recompute_library_sizes failed')
  process.exit(1)
}

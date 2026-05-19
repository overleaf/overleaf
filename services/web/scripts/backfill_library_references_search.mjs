// @ts-check
import minimist from 'minimist'
import logger from '@overleaf/logger'
import { db } from '../app/src/infrastructure/mongodb.mjs'
import { buildSearchFields } from '../modules/library/app/src/LibraryReferenceRepository.mts'
import { scriptRunner } from './lib/ScriptRunner.mjs'

/** @typedef {import('mongodb').AnyBulkWriteOperation} AnyBulkWriteOperation */

const argv = minimist(process.argv.slice(2), {
  boolean: ['commit', 'rollback', 'all', 'help'],
  default: { 'batch-size': 1000 },
})

function usage() {
  logger.info(
    {},
    `Usage: node backfill_library_references_search.mjs [options]

Populates searchKey and fields.searchValue on libraryReferences so the
account-level library search can index them. Safe to rerun; picks up only
un-indexed rows by default.

Options:
  --commit          Apply changes. Without this, runs as a dry run.
  --rollback        Unset searchKey and fields.searchValue on all rows that
                    have them. Mirrors the original migration's rollback.
  --all             Re-index every row, not just rows where searchKey is null.
                    Use when the tokenization format has changed.
  --batch-size <n>  bulkWrite batch size (default 1000).
`
  )
}

if (argv.help) {
  usage()
  process.exit(0)
}

const BATCH_SIZE = Number(argv['batch-size'])

/** @param {(message: string) => Promise<void>} trackProgress */
async function backfill(trackProgress) {
  const filter = argv.all ? {} : { searchKey: null }
  const cursor = db.libraryReferences
    .find(filter)
    .hint({ userId: 1, searchKey: 1 })
    .project({ key: 1, fields: 1 })

  let processed = 0
  /** @type {AnyBulkWriteOperation[]} */
  let ops = []

  const flush = async () => {
    if (ops.length === 0) return
    if (argv.commit) {
      await db.libraryReferences.bulkWrite(ops, { ordered: false })
    }
    processed += ops.length
    await trackProgress(
      `${argv.commit ? 'wrote' : '[dry-run]'} ${processed} docs`
    )
    ops = []
  }

  for await (const doc of cursor) {
    const { searchKey, fields } = buildSearchFields({
      key: doc.key,
      fields: (doc.fields ?? []).map(
        (/** @type {{ name: string; editableValue?: string }} */ f) => ({
          name: f.name,
          editableValue: f.editableValue ?? '',
        })
      ),
    })
    ops.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { searchKey, fields } },
      },
    })
    if (ops.length >= BATCH_SIZE) {
      await flush()
    }
  }
  await flush()
  await trackProgress(`done; processed ${processed} docs`)
}

/** @param {(message: string) => Promise<void>} trackProgress */
async function rollback(trackProgress) {
  if (!argv.commit) {
    const count = await db.libraryReferences.countDocuments({
      searchKey: { $ne: null },
    })
    await trackProgress(`[dry-run] would unset search fields on ${count} docs`)
    return
  }
  const result = await db.libraryReferences.updateMany(
    { searchKey: { $ne: null } },
    { $unset: { searchKey: 1, 'fields.$[].searchValue': 1 } },
    { hint: { userId: 1, searchKey: 1 } }
  )
  await trackProgress(`unset search fields on ${result.modifiedCount} docs`)
}

/** @param {(message: string) => Promise<void>} trackProgress */
async function main(trackProgress) {
  if (!argv.commit) {
    await trackProgress('DRY RUN. Pass --commit to apply changes.')
  }
  if (argv.rollback) {
    await rollback(trackProgress)
  } else {
    await backfill(trackProgress)
  }
}

try {
  await scriptRunner(main, {
    commit: Boolean(argv.commit),
    rollback: Boolean(argv.rollback),
    all: Boolean(argv.all),
    batchSize: BATCH_SIZE,
  })
  process.exit(0)
} catch (err) {
  logger.error({ err }, 'backfill failed')
  process.exit(1)
}

// @ts-check
import minimist from 'minimist'
import logger from '@overleaf/logger'
import { db } from '../app/src/infrastructure/mongodb.mjs'
import {
  buildSearchTokens,
  buildMatchTokens,
  docSchema,
} from '../modules/library/app/src/LibraryReferenceRepository.mts'
import { tokenize } from '../modules/library/app/src/bibtex-search-tokens.mts'
import { scriptRunner } from './lib/ScriptRunner.mjs'

/** @typedef {import('mongodb').AnyBulkWriteOperation} AnyBulkWriteOperation */

const argv = minimist(process.argv.slice(2), {
  boolean: ['commit', 'all', 'help'],
  default: { 'batch-size': 1000 },
})

function usage() {
  logger.info(
    {},
    `Usage: node backfill_library_references_search.mjs [options]

Populates searchKey, searchTokens and matchTokens on libraryReferences so
the account-level library search and import duplicate-detection can index
them. Also unsets the obsolete fields.$[].searchValue. Safe to rerun; picks
up only un-indexed rows by default.

Options:
  --commit          Apply changes. Without this, runs as a dry run.
  --all             Re-index every row, not just rows where searchTokens
                    is null. Use when the tokenization format has changed.
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
  const filter = argv.all ? {} : { searchTokens: null }
  const cursor = db.libraryReferences
    .find(filter)
    .project({ key: 1, type: 1, fields: 1, updatedAt: 1 })

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
    const entry = docSchema.parse({
      ...doc,
      type: doc.type ?? 'misc',
      updatedAt: doc.updatedAt ?? new Date(0),
    })
    const searchKey = tokenize(doc.key)
    const searchTokens = buildSearchTokens(entry)
    const matchTokens = buildMatchTokens(entry)
    ops.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: { searchKey, searchTokens, matchTokens },
          $unset: { 'fields.$[].searchValue': 1 },
        },
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
async function main(trackProgress) {
  if (!argv.commit) {
    await trackProgress('DRY RUN. Pass --commit to apply changes.')
  }
  await backfill(trackProgress)
}

try {
  await scriptRunner(main, {
    commit: Boolean(argv.commit),
    all: Boolean(argv.all),
    batchSize: BATCH_SIZE,
  })
  process.exit(0)
} catch (err) {
  logger.error({ err }, 'backfill failed')
  process.exit(1)
}

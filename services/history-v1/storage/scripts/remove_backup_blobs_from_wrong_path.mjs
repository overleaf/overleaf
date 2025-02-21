// @ts-check

/**
 * This script is used to remove blobs that have been backed up under the project ID
 * instead of the history ID (where those are different).
 *
 * This script reads a CSV file with the following format:
 * ```
 * project_id,hash
 * <mongo ID>,<hash>
 * ```
 *
 * The header row is optional. All rows will be checked for conformance to the format.
 */

import commandLineArgs from 'command-line-args'
import { backupPersistor, projectBlobsBucket } from '../lib/backupPersistor.mjs'
import { makeProjectKey } from '../lib/blob_store/index.js'
import fs from 'node:fs'
import assert from '../lib/assert.js'
import { client } from '../lib/mongodb.js'
import { verifyBlobs } from '../lib/backupVerifier.mjs'
import { setTimeout } from 'node:timers/promises'
import { getHistoryId } from '../lib/backup_store/index.js'

const argsSchema = [
  {
    name: 'input',
    type: String,
  },
  {
    name: 'commit',
    type: Boolean,
  },
  {
    name: 'header',
    type: Boolean,
  },
  {
    name: 'force',
    type: Boolean,
  },
  {
    name: 'verbose',
    type: Boolean,
  },
]

const args = commandLineArgs(argsSchema)

async function gracefulClose(code = 0) {
  await client.close()
  process.exit(code)
}

/**
 *
 * @param {(value: unknown) => void} fn
 * @param {unknown} value
 * @return {boolean}
 */
function not(fn, value) {
  try {
    fn(value)
    return false
  } catch {
    return true
  }
}

/**
 *
 * @param {string} row
 * @return {{projectId: string, hash: string}}
 */
function parseCSVRow(row) {
  const [projectId, hash] = row.split(',')
  assert.mongoId(projectId, `invalid projectId ${projectId}`)
  assert.blobHash(hash, `invalid hash ${hash}`)
  return { projectId, hash }
}

/**
 *
 * @param {string} path
 * @param {boolean} hasHeader
 * @return {AsyncGenerator<{projectId: string, hash: string}, void, *>}
 */
async function* readCSV(path, hasHeader) {
  let seenHeader = !hasHeader
  let fh
  try {
    fh = await fs.promises.open(path, 'r')
  } catch (error) {
    console.error(`Could not open file: ${error}`)
    return await gracefulClose(1)
  }
  for await (const line of fh.readLines()) {
    if (!seenHeader) {
      const [first, second] = line.split(',')
      const noDataInHeader =
        not(assert.mongoId, first) && not(assert.blobHash, second)
      if (!noDataInHeader) {
        console.error('Data found in header row')
        return await gracefulClose(1)
      }
      seenHeader = true
      continue
    }
    try {
      yield parseCSVRow(line)
    } catch (error) {
      console.error(error instanceof Error ? error.message : error)
      console.info(`Skipping invalid row: ${line}`)
    }
  }
}

function usage() {
  console.info(
    'Usage: remove_blobs_from_backup.mjs --input <path> [--commit] [--header] [--force] [--verbose]'
  )
}

if (!args.input) {
  console.error('--input was missing')
  usage()
  await gracefulClose(1)
}

/**
 *
 * @param {string} projectId
 * @param {string} hash
 * @return {Promise<void>}
 */
async function deleteBlob(projectId, hash) {
  const path = makeProjectKey(projectId, hash)
  if (args.commit) {
    await backupPersistor.deleteObject(projectBlobsBucket, path)
  } else {
    console.log(`DELETE: ${path}`)
  }
}

/**
 *
 * @param {string} projectId
 * @param {string} hash
 * @return {Promise<void>}
 */
async function canDeleteBlob(projectId, hash) {
  let historyId
  try {
    historyId = await getHistoryId(projectId)
  } catch (error) {
    if (args.verbose) {
      console.error(error)
    }
    throw new Error(`No history ID found for project ${projectId}, skipping`)
  }
  if (historyId === projectId) {
    throw new Error(
      `Project ID and history ID are the same for ${projectId} - use --force to delete anyway`
    )
  }

  // TODO: fix assert.postgresId to handle integers better and then stop coercing to string below
  assert.postgresId(
    `${historyId}`,
    `History ID ${historyId} does not appear to be for a postgres project`
  )

  try {
    await verifyBlobs(`${historyId}`, [hash])
  } catch (error) {
    if (args.verbose) {
      console.error(error)
    }
    throw new Error(
      `Blob ${hash} is not backed up for project ${projectId} - use --force to delete anyway`
    )
  }
}

if (!args.commit) {
  console.log('DRY RUN: provide --commit to perform operations')
}

if (args.force) {
  console.log(
    'WARNING: --force is enabled, blobs will be deleted regardless of backup status'
  )
  await setTimeout(5_000)
}

let deleted = 0
let errors = 0

for await (const { projectId, hash } of readCSV(args.input, args.header)) {
  if (!args.force) {
    try {
      await canDeleteBlob(projectId, hash)
    } catch (error) {
      console.error(error instanceof Error ? error.message : error)
      continue
    }
  }
  try {
    await deleteBlob(projectId, hash)
    deleted++
  } catch (error) {
    errors++
    console.error(error)
  }
}

console.log(`Deleted: ${deleted}`)
console.log(`Errors: ${errors}`)

await gracefulClose()

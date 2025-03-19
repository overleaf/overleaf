// @ts-check
import { loadGlobalBlobs } from '../lib/blob_store/index.js'
import commandLineArgs from 'command-line-args'
import assert from '../lib/assert.js'
import fs from 'node:fs'
import { setTimeout } from 'node:timers/promises'
import {
  archiveLatestChunk,
  archiveRawProject,
} from '../lib/backupArchiver.mjs'
import knex from '../lib/knex.js'
import { client } from '../lib/mongodb.js'
import archiver from 'archiver'

const SUPPORTED_MODES = ['raw', 'latest']

// outputFile needs to be available in the shutdown function (which may be called before it's declared)
// eslint-disable-next-line prefer-const
let outputFile

/**
 * Gracefully shutdown the process
 * @param {number} code
 */
async function shutdown(code = 0) {
  if (outputFile) {
    outputFile.close()
  }
  await Promise.all([knex.destroy(), client.close()])
  await setTimeout(1000)
  process.exit(code)
}

/**
 * @typedef {import('archiver').ZipArchive} ZipArchive
 */

/**
 * @typedef {import('archiver').ProgressData} ProgressData
 */

/**
 * @typedef {import('archiver').EntryData} EntryData
 */

/**
 * @typedef {Object} ArchiverError
 * @property {string} message
 * @property {string} code
 * @property {Object} data
 */

const { historyId, mode, output, verbose } = commandLineArgs([
  { name: 'historyId', type: String },
  { name: 'output', type: String },
  { name: 'mode', type: String, defaultValue: 'raw' },
  { name: 'verbose', type: String, defaultValue: false },
])

if (!historyId) {
  console.error('missing --historyId')
  await shutdown(1)
}

if (!output) {
  console.error('missing --output')

  await shutdown(1)
}

try {
  assert.projectId(historyId)
} catch (error) {
  console.error('Invalid history ID')
  await shutdown(1)
}

if (!SUPPORTED_MODES.includes(mode)) {
  console.error(
    'Invalid mode; supported modes are: ' + SUPPORTED_MODES.join(', ')
  )
  await shutdown(1)
}

await loadGlobalBlobs()

outputFile = fs.createWriteStream(output)

const archive = archiver.create('zip', {})

archive.on('close', function () {
  console.log(archive.pointer() + ' total bytes')
  console.log(`Wrote ${output}`)
  shutdown().catch(e => console.error('Error shutting down', e))
})

archive.on(
  'error',
  /**
   *
   * @param {ArchiverError} e
   */
  function (e) {
    console.error(`Error writing archive: ${e.message}`)
  }
)

archive.on('end', function () {
  console.log(`Wrote ${archive.pointer()} total bytes to ${output}`)
  shutdown().catch(e => console.error('Error shutting down', e))
})

archive.on(
  'progress',
  /**
   *
   * @param {ProgressData} progress
   */
  function (progress) {
    if (verbose) {
      console.log(`${progress.entries.processed} / ${progress.entries.total}`)
    }
  }
)

archive.on(
  'entry',
  /**
   *
   * @param {EntryData} entry
   */
  function (entry) {
    if (verbose) {
      console.log(`${entry.name} added`)
    }
  }
)

archive.on(
  'warning',
  /**
   *
   * @param {ArchiverError} warning
   */
  function (warning) {
    console.warn(`Warning writing archive: ${warning.message}`)
  }
)

switch (mode) {
  case 'latest':
    await archiveLatestChunk(archive, historyId)
    break
  case 'raw':
  default:
    await archiveRawProject(archive, historyId)
    break
}

archive.pipe(outputFile)

await archive.finalize()

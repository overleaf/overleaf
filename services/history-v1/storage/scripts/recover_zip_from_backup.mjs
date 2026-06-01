// @ts-check
import { loadGlobalBlobs } from '../lib/blob_store/index.js'
import commandLineArgs from 'command-line-args'
import assert from '../lib/assert.js'
import fs from 'node:fs'
import { setTimeout } from 'node:timers/promises'
import { pipeline } from 'node:stream/promises'
import {
  archiveLatestChunk,
  archiveRawProject,
  BackupPersistorError,
} from '../lib/backupArchiver.mjs'
import knex from '../lib/knex.js'
import { client } from '../lib/mongodb.js'
import ZipStream from 'zip-stream'
import { Chunk } from 'overleaf-editor-core'
import _ from 'lodash'

const SUPPORTED_MODES = ['raw', 'latest']

// Pads the mode name to a fixed length for alignment.
const padModeName = _.partialRight(
  _.padEnd,
  Math.max(...SUPPORTED_MODES.map(mode => mode.length))
)

const SUPPORTED_MODES_HELP = {
  raw: 'Retrieve all chunk and blob files from the project backup.',
  latest: 'Retrieves the last backed up state of the project.',
}

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
  await knex.destroy()
  await client.close()
  await setTimeout(1000)
  process.exit(code)
}

function usage() {
  console.log(
    'Usage: node recover_zip_from_backup.mjs --historyId=<historyId> --output=<output> [--mode=<mode>] [--verbose] [--useBackupGlobalBlobs]'
  )
  console.log(
    '--useBackupGlobalBlobs can be used if the global blobs have not been restored from the backup yet.'
  )
  console.log('Supported modes: ' + SUPPORTED_MODES.join(', '))
  SUPPORTED_MODES.forEach(mode => {
    console.log(
      `    --mode=${padModeName(mode)} -  ${SUPPORTED_MODES_HELP[mode] || ''}`
    )
  })
}

let historyId, help, mode, output, useBackupGlobalBlobs, verbose

try {
  ;({ historyId, help, mode, output, useBackupGlobalBlobs, verbose } =
    commandLineArgs([
      { name: 'historyId', type: String },
      { name: 'output', type: String },
      { name: 'mode', type: String, defaultValue: 'raw' },
      { name: 'verbose', type: Boolean, defaultValue: false },
      { name: 'useBackupGlobalBlobs', type: Boolean, defaultValue: false },
      { name: 'help', type: Boolean },
    ]))
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  help = true
}

if (help) {
  usage()
  await shutdown(0)
}

if (!historyId) {
  console.error('missing --historyId')
  usage()
  await shutdown(1)
}

if (!output) {
  console.error('missing --output')
  usage()
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

const archive = new ZipStream()

archive.on('error', function (e) {
  console.error(`Error writing archive: ${e.message}`)
})

try {
  // Pipe archive to the output file before adding entries.
  // pipeline handles backpressure and will resolve when
  // the archive stream ends.
  const pipelinePromise = pipeline(archive, outputFile)

  switch (mode) {
    case 'latest':
      await archiveLatestChunk(
        archive,
        historyId,
        useBackupGlobalBlobs,
        verbose
      )
      break
    case 'raw':
    default:
      await archiveRawProject(archive, historyId, useBackupGlobalBlobs, verbose)
      break
  }

  archive.finalize()
  await pipelinePromise

  console.log(`Wrote ${archive.getBytesWritten()} total bytes to ${output}`)
} catch (error) {
  if (error instanceof BackupPersistorError) {
    console.error(error.message)
  }
  if (error instanceof Chunk.NotPersistedError) {
    console.error('Chunk not found. Project may not have been fully backed up.')
  }
  if (verbose) {
    console.error(error)
  } else {
    console.error('Error encountered when writing archive')
  }
  await shutdown(1)
}

await shutdown(0)

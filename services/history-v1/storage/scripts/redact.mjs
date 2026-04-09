import fs from 'node:fs'
import { Readable } from 'node:stream'
import { createRequire } from 'node:module'
import * as readline from 'node:readline/promises'
import commandLineArgs from 'command-line-args'
import { makeProjectKey } from '../lib/blob_store/index.js'
import { client } from '../lib/mongodb.js'
import knex from '../lib/knex.js'
import redis from '../lib/redis.js'

const require = createRequire(import.meta.url)
const config = require('config')
const persistor = require('../lib/persistor.js')
const { Errors } = require('@overleaf/object-persistor')

const optionDefinitions = [
  { name: 'historyId', alias: 'p', type: String },
  { name: 'blob', alias: 'b', type: String },
  { name: 'file', alias: 'f', type: String },
  { name: 'empty', alias: 'e', type: Boolean },
  { name: 'delete', alias: 'd', type: Boolean },
  { name: 'yes', alias: 'y', type: Boolean },
  { name: 'message', alias: 'm', type: String },
]

async function replaceBlob(historyId, blobHash, options) {
  const bucket = config.get('blobStore.projectBucket')
  const key = makeProjectKey(historyId, blobHash)

  // 1. Check existence
  let originalSize
  try {
    originalSize = await persistor.getObjectSize(bucket, key)
    console.log(`Found blob ${blobHash} of size ${originalSize} bytes`)
  } catch (err) {
    if (
      err instanceof Errors.NotFoundError ||
      err.code === 'NoSuchKey' ||
      err.name === 'NoSuchKey'
    ) {
      throw new Error(`Blob ${blobHash} not found in project ${historyId}`)
    }
    throw err
  }

  // 2. Prepare action
  let stream
  let streamSize
  let actionDesc
  if (!options.delete) {
    if (options.empty) {
      stream = Readable.from([])
      streamSize = 0
      actionDesc = 'empty file'
    } else if (options.file) {
      const stat = fs.statSync(options.file)
      stream = fs.createReadStream(options.file)
      streamSize = stat.size
      actionDesc = `file ${options.file}`
    } else {
      const baseMessage = options.message || 'REDACTED'
      const msg = `${baseMessage} ${new Date().toISOString()}`
      const buf = Buffer.from(msg, 'utf8')
      stream = Readable.from([buf])
      streamSize = buf.length
      actionDesc = `message "${msg}"`
    }
  }

  const actionLog = options.delete
    ? `Deleting blob ${blobHash} in ${historyId}`
    : `Replacing blob ${blobHash} in ${historyId} with ${actionDesc} (${streamSize} bytes)`

  console.log(actionLog)

  if (!options.yes) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    const answer = await rl.question('Proceed (Y/N)? ')
    rl.close()
    if (answer.toLowerCase() !== 'y') {
      console.log('Aborted.')
      return
    }
  }

  // 3. Execute action
  if (options.delete) {
    await persistor.deleteObject(bucket, key)
    console.log('Blob deleted successfully.')
  } else {
    await persistor.sendStream(bucket, key, stream, {
      contentType: 'application/octet-stream',
      contentLength: streamSize,
    })
    console.log('Blob replaced successfully.')
  }
}

async function main() {
  const options = commandLineArgs(optionDefinitions)
  if (!options.historyId) {
    console.error('Error: --historyId is required.')
    process.exit(1)
  }
  if (!options.blob) {
    console.error('Error: --blob is required.')
    process.exit(1)
  }

  const activeModes = [
    options.delete ? '--delete' : null,
    options.empty ? '--empty' : null,
    options.file ? '--file' : null,
    options.message !== undefined ? '--message' : null,
  ].filter(Boolean)

  if (activeModes.length > 1) {
    console.error(
      `Error: Conflicting options provided (${activeModes.join(
        ', '
      )}). Please select exactly one redaction mode.`
    )
    process.exit(1)
  }

  await replaceBlob(options.historyId, options.blob, options)
}

main()
  .then(() => console.log('Done.'))
  .catch(err => {
    console.error('Error:', err.message)
    process.exit(1)
  })
  .finally(() => {
    knex.destroy().catch(err => console.error('Error closing Postgres:', err))
    client.close().catch(err => console.error('Error closing MongoDB:', err))
    redis
      .disconnect()
      .catch(err => console.error('Error disconnecting Redis:', err))
  })

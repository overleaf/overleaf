/**
 * A script to export the global blobs from mongo to a CSV file.
 *
 * node storage/scripts/export_global_blobs.mjs --output global_blobs.csv
 *
 * The output CSV has the following format:
 *
 * hash,path,byteLength,stringLength,demoted
 *
 * hash: the hash of the blob
 * path: the path of the blob in the blob store
 * byteLength: the byte length of the blob, or empty if unknown
 * stringLength: the string length of the blob, or empty if unknown
 * demoted: true if the blob has been demoted to a reference, false otherwise
 */

// @ts-check
import { ObjectId } from 'mongodb'
import { GLOBAL_BLOBS, loadGlobalBlobs } from '../lib/blob_store/index.js'
import { client } from '../lib/mongodb.js'
import commandLineArgs from 'command-line-args'
import fs from 'node:fs'

// Enable caching for ObjectId.toString()
ObjectId.cacheHexString = true

function parseArgs() {
  const args = commandLineArgs([
    {
      name: 'output',
      type: String,
      alias: 'o',
    },
  ])
  const OUTPUT_STREAM = fs.createWriteStream(args['output'], { flags: 'wx' })

  return {
    OUTPUT_STREAM,
  }
}

const { OUTPUT_STREAM } = parseArgs()

async function main() {
  await loadGlobalBlobs()
  OUTPUT_STREAM.write('hash,path,byteLength,stringLength,demoted\n')
  for (const [hash, { blob, demoted }] of GLOBAL_BLOBS) {
    const { hash: blobHash, byteLength, stringLength } = blob
    if (blobHash !== hash) {
      throw new Error(`hash mismatch: ${hash} !== ${blobHash}`)
    }
    const path = blobHash.slice(0, 2) + '/' + blobHash.slice(2)
    const byteLengthStr = byteLength === null ? '' : byteLength
    const stringLengthStr = stringLength === null ? '' : stringLength
    OUTPUT_STREAM.write(
      `${hash},${path},${byteLengthStr},${stringLengthStr},${demoted}\n`
    )
  }
}

main()
  .then(() => console.log('Done.'))
  .catch(err => {
    console.error('Error:', err)
    process.exitCode = 1
  })
  .finally(() => {
    client.close().catch(err => console.error('Error closing MongoDB:', err))
  })

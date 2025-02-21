// @ts-check
import { readFileSync } from 'node:fs'
import commandLineArgs from 'command-line-args'
import { client } from '../lib/mongodb.js'
import {
  getBackedUpBlobHashes,
  unsetBackedUpBlobHashes,
} from '../lib/backup_store/index.js'

let gracefulShutdownInitiated = false

// Parse command line arguments
const args = commandLineArgs([
  { name: 'input', type: String, alias: 'i', defaultOption: true },
  { name: 'commit', type: Boolean, default: false },
])

if (!args.input) {
  console.error(
    'Usage: node remove_backed_up_blobs.mjs --input <csv-file> [--commit]'
  )
  process.exit(1)
}

if (!args.commit) {
  console.log('Running in dry-run mode. Use --commit to apply changes.')
}

// Signal handling
process.on('SIGINT', handleSignal)
process.on('SIGTERM', handleSignal)

function handleSignal() {
  console.warn('Graceful shutdown initiated')
  gracefulShutdownInitiated = true
}

// Process CSV and remove blobs
async function main() {
  const projectBlobs = new Map()
  const lines = readFileSync(args.input, 'utf8').split('\n')
  const SHA1_HEX_REGEX = /^[a-f0-9]{40}$/

  // Skip header
  for (const line of lines.slice(1)) {
    if (!line.trim() || gracefulShutdownInitiated) break

    const [projectId, path] = line.split(',')
    const pathParts = path.split('/')
    const hash = pathParts[3] + pathParts[4]

    if (!SHA1_HEX_REGEX.test(hash)) {
      console.warn(`Invalid SHA1 hash for project ${projectId}: ${hash}`)
      continue
    }

    if (!projectBlobs.has(projectId)) {
      projectBlobs.set(projectId, new Set())
    }
    projectBlobs.get(projectId).add(hash)
  }

  // Process each project
  for (const [projectId, hashes] of projectBlobs) {
    if (gracefulShutdownInitiated) break

    if (!args.commit) {
      console.log(
        `DRY-RUN: would remove ${hashes.size} blobs from project ${projectId}`
      )
      continue
    }

    try {
      const originalHashes = await getBackedUpBlobHashes(projectId)
      if (originalHashes.size === 0) {
        continue
      }
      const result = await unsetBackedUpBlobHashes(
        projectId,
        Array.from(hashes)
      )
      if (result) {
        console.log(
          `Project ${projectId}: want to remove ${hashes.size}, removed ${originalHashes.size - result.blobs.length}, ${result.blobs.length} remaining`
        )
      }
    } catch (err) {
      console.error(`Error updating project ${projectId}:`, err)
    }
  }
}

// Run the script
main()
  .catch(err => {
    console.error('Fatal error:', err)
    process.exitCode = 1
  })
  .finally(() => {
    client
      .close()
      .catch(err => console.error('Error closing MongoDB connection:', err))
  })

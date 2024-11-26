import logger from '@overleaf/logger'
import commandLineArgs from 'command-line-args'
import { verifyBlobs } from '../lib/backupVerifier.mjs'

const { historyId, hashes } = commandLineArgs([
  { name: 'historyId', type: String },
  { name: 'hashes', type: String, multiple: true, defaultOption: true },
])

if (hashes.length === 0) {
  throw new Error('missing --hashes flag')
}

try {
  await verifyBlobs(historyId, hashes)
  console.log('OK')
  process.exit(0)
} catch (err) {
  logger.err({ err }, 'failed to verify blob')
  process.exit(1)
}

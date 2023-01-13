const fs = require('fs')
const fsExtra = require('fs-extra')
const logger = require('@overleaf/logger')
const os = require('os')
const path = require('path')

/**
 * Create a temporary directory before executing a function and cleaning up
 * after.
 *
 * @param {string} prefix - prefix for the temporary directory name
 * @param {Function} fn - async function to call
 */
async function withTmpDir(prefix, fn) {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), prefix))
  try {
    await fn(tmpDir)
  } finally {
    fsExtra.remove(tmpDir).catch(err => {
      if (err.code !== 'ENOENT') {
        logger.error({ err }, 'failed to delete temporary file')
      }
    })
  }
}

module.exports = withTmpDir

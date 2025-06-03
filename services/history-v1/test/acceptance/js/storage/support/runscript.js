'use strict'

const { promisify } = require('node:util')
const { execFile } = require('node:child_process')

async function runScript(scriptPath, options = {}) {
  const TIMEOUT = options.timeout || 10 * 1000 // 10 seconds default
  let result
  try {
    result = await promisify(execFile)('node', [scriptPath], {
      encoding: 'utf-8',
      timeout: TIMEOUT,
      env: {
        ...process.env,
        LOG_LEVEL: 'debug', // Override LOG_LEVEL for script output
      },
    })
    result.status = 0
  } catch (err) {
    const { stdout, stderr, code } = err
    if (typeof code !== 'number') {
      console.error(`Error running script ${scriptPath}:`, err)
      throw err
    }
    result = { stdout, stderr, status: code }
  }
  // The script might exit with status 1 if it finds no keys to process, which is ok
  if (result.status !== 0 && result.status !== 1) {
    console.error(`Script ${scriptPath} failed:`, result.stderr)
    throw new Error(`Script ${scriptPath} failed with status ${result.status}`)
  }
  return result
}

module.exports = { runScript }

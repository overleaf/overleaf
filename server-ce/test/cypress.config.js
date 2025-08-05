const { defineConfig } = require('cypress')
const { readPdf, readFileInZip } = require('./helpers/read-file')
const fs = require('node:fs')

if (process.env.CYPRESS_SHARD && !process.env.SPEC_PATTERN) {
  // Running Cypress on all the specs is wasteful (~1min) when only few of them
  // will have relevant tasks to run for a given shard. Filter the spec files
  // based on the existence of the shard identifier in the spec source.
  const files = []
  for (const name of fs.readdirSync('.')) {
    if (!name.endsWith('.spec.ts')) continue
    const src = fs.readFileSync(name, 'utf-8')
    if (!src.includes('isExcludedBySharding(')) {
      throw new Error(
        `Spec ${name} is not using sharding. Add an appropriate "'if (isExcludedBySharding('...')) return" call.`
      )
    }
    if (!src.includes(process.env.CYPRESS_SHARD)) continue
    files.push(name)
  }
  if (files.length === 0) {
    throw new Error(
      `Bad process.env.CYPRESS_SHARD=${process.env.CYPRESS_SHARD}; no spec files matched!`
    )
  }
  if (files.length === 1) {
    // Cypress does not like `{single-file}`. Make this a special case.
    process.env.SPEC_PATTERN = `./${files[0]}`
  } else {
    process.env.SPEC_PATTERN = `./{${files.join(',')}}`
  }
}

const specPattern = process.env.SPEC_PATTERN || './**/*.spec.ts'

module.exports = defineConfig({
  defaultCommandTimeout: 10_000,
  fixturesFolder: 'cypress/fixtures',
  video: process.env.CYPRESS_VIDEO === 'true',
  screenshotsFolder: 'cypress/results',
  videosFolder: 'cypress/results',
  videoUploadOnPasses: false,
  viewportHeight: 768,
  viewportWidth: 1024,
  e2e: {
    baseUrl: 'http://localhost',
    setupNodeEvents(on, config) {
      on('task', {
        readPdf,
        readFileInZip,
      })
    },
    specPattern,
  },
  retries: {
    runMode: 3,
  },
})

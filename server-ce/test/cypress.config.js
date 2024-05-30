const { defineConfig } = require('cypress')

const specPattern = process.env.SPEC_PATTERN || './**/*.spec.{js,ts,tsx}'

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
      // implement node event listeners here
    },
    specPattern,
  },
  retries: {
    runMode: 1,
  },
})

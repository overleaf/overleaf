import { defineConfig } from 'cypress'
import { webpackConfig } from './cypress/support/webpack.cypress'

let reporterOptions = {}
if (process.env.CI) {
  reporterOptions = {
    reporter: '/overleaf/node_modules/cypress-multi-reporters',
    reporterOptions: {
      configFile: 'cypress/cypress-multi-reporters.json',
    },
  }
}

export default defineConfig({
  fixturesFolder: 'cypress/fixtures',
  video: process.env.CYPRESS_VIDEO === 'true',
  downloadsFolder: process.env.CYPRESS_DOWNLOADS || 'cypress/downloads',
  screenshotsFolder: process.env.CYPRESS_RESULTS || 'cypress/results',
  videosFolder: process.env.CYPRESS_RESULTS || 'cypress/results',
  viewportHeight: 800,
  viewportWidth: 800,
  component: {
    devServer: {
      framework: 'react',
      bundler: 'webpack',
      webpackConfig,
    },
    setupNodeEvents(on, config) {
      //
    },
    specPattern:
      process.env.CYPRESS_SPEC_PATTERN ||
      './{test,modules/**/test}/frontend/**/*.spec.{js,jsx,ts,tsx}',
    excludeSpecPattern: process.env.CYPRESS_EXCLUDE_SPEC_PATTERN,
  },
  retries: {
    runMode: 3,
  },
  ...reporterOptions,
})

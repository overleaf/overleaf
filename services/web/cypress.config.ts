import { defineConfig } from 'cypress'
import { webpackConfig } from './cypress/support/webpack.cypress'

export default defineConfig({
  fixturesFolder: 'cypress/fixtures',
  video: !!process.env.CI,
  screenshotsFolder: 'cypress/results',
  videosFolder: 'cypress/results',
  videoUploadOnPasses: false,
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
      './{test,modules/**/test}/frontend/**/*.spec.{js,ts,tsx}',
    excludeSpecPattern: process.env.CYPRESS_EXCLUDE_SPEC_PATTERN,
  },
  retries: {
    runMode: 3,
  },
})

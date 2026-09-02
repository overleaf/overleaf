import { defineConfig } from 'cypress'
import { webpackConfig } from './cypress/support/webpack.cypress'

// Cypress builds reporters in its Electron process, which has no Yarn PnP.
// @overleaf/cypress-pnp-reporter loads cypress-multi-reporters there.
let reporterOptions = {}
if (process.env.CI) {
  reporterOptions = {
    reporter: require.resolve('@overleaf/cypress-pnp-reporter'),
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
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.family === 'chromium') {
          // Cypress adds this for docker's default 64MB /dev/shm; the compose services raise shm_size instead, so Chrome's shared memory stays in RAM.
          const noDevShm = launchOptions.args.indexOf('--disable-dev-shm-usage')
          if (noDevShm !== -1) {
            launchOptions.args.splice(noDevShm, 1)
          }
        }
        return launchOptions
      })
    },
    specPattern:
      process.env.CYPRESS_SPEC_PATTERN ||
      './{test,modules/**/test}/frontend/**/*.spec.{js,jsx,ts,tsx}',
    excludeSpecPattern: process.env.CYPRESS_EXCLUDE_SPEC_PATTERN,
  },
  retries: {
    runMode: parseInt(process.env.CYPRESS_RETRIES || '3', 10) || 3,
  },
  ...reporterOptions,
})

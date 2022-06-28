import { defineConfig } from 'cypress'
import { webpackConfig } from './cypress/support/webpack.cypress'

export default defineConfig({
  fixturesFolder: 'cypress/fixtures',
  video: false,
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
      './{test,modules/**/test}/frontend/components/**/*.spec.{js,ts,tsx}',
  },
  retries: {
    runMode: 3,
  },
})

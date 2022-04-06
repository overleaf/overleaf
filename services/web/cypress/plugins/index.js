module.exports = (on, config) => {
  if (config.testingType === 'component') {
    const { startDevServer } = require('@cypress/webpack-dev-server')
    const { merge } = require('webpack-merge')
    const path = require('path')
    const devConfig = require('../../webpack.config.dev')

    const webpackConfig = merge(devConfig, {
      devServer: {
        static: path.join(__dirname, '../../../../public'),
      },
      stats: 'none',
    })

    delete webpackConfig.devServer.client

    on('dev-server:start', options => {
      return startDevServer({ options, webpackConfig })
    })
  }
}

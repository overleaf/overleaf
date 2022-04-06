module.exports = (on, config) => {
  if (config.testingType === 'component') {
    const { startDevServer } = require('@cypress/webpack-dev-server')
    const { merge } = require('webpack-merge')
    const path = require('path')
    const webpack = require('webpack')
    const devConfig = require('../../webpack.config.dev')

    const webpackConfig = merge(devConfig, {
      devServer: {
        static: path.join(__dirname, '../../public'),
      },
      stats: 'none',
      plugins: [
        new webpack.EnvironmentPlugin({
          CYPRESS: true,
        }),
      ],
    })

    delete webpackConfig.devServer.client

    webpackConfig.entry = {}
    const addWorker = (name, importPath) => {
      webpackConfig.entry[name] = require.resolve(importPath)
    }

    // add entrypoint under '/' for latex-linter worker
    addWorker(
      'latex-linter-worker',
      '../../modules/source-editor/frontend/js/languages/latex/linter/latex-linter.worker.js'
    )

    // add entrypoints under '/' for pdfjs workers
    const pdfjsVersions = ['pdfjs-dist210', 'pdfjs-dist213']
    for (const name of pdfjsVersions) {
      addWorker(name, `${name}/legacy/build/pdf.worker.js`)
    }

    on('dev-server:start', options => {
      return startDevServer({ options, webpackConfig })
    })
  }
}

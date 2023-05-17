import { merge } from 'webpack-merge'
import path from 'path'
import webpack from 'webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import devConfig from '../../webpack.config.dev'

const buildConfig = () => {
  const webpackConfig = merge(devConfig, {
    devServer: {
      static: path.join(__dirname, '../../public'),
      port: 3200,
    },
    stats: 'none',
    plugins: [
      new webpack.EnvironmentPlugin({
        CYPRESS: true,
      }),
      new HtmlWebpackPlugin({
        template: path.resolve('./component-index.html'),
      }),
    ],
  } as any)

  delete webpackConfig.devServer.client

  webpackConfig.entry = {}
  const addWorker = (name: string, importPath: string) => {
    webpackConfig.entry[name] = require.resolve(importPath)
  }

  // add entrypoint under '/' for latex-linter worker
  addWorker(
    'latex-linter-worker',
    '../../frontend/js/features/source-editor/languages/latex/linter/latex-linter.worker.js'
  )

  // add entrypoints under '/' for pdfjs workers
  const pdfjsVersions = ['pdfjs-dist213', 'pdfjs-dist36']
  for (const name of pdfjsVersions) {
    addWorker(name, `${name}/legacy/build/pdf.worker.js`)
  }

  return webpackConfig
}

export const webpackConfig = buildConfig()

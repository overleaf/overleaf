import { merge } from 'webpack-merge'
import path from 'path'
import webpack from 'webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import devConfig from '../../webpack.config.dev'

const buildConfig = () => {
  const webpackConfig = merge(devConfig, {
    output: {
      workerPublicPath: '/__cypress/src/',
    },
    devServer: {
      static: {
        directory: path.join(__dirname, '../../public'),
        watch: false,
      },
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
    '../../frontend/js/features/source-editor/languages/latex/linter/latex-linter.worker'
  )

  // add entrypoint under '/' for hunspell worker
  addWorker(
    'hunspell-worker',
    '../../frontend/js/features/source-editor/hunspell/hunspell.worker'
  )

  // add entrypoint under '/' for references worker
  addWorker(
    'references-worker',
    '../../frontend/js/features/ide-react/references/references.worker.ts'
  )

  // add entrypoints under '/' for pdfjs workers
  addWorker('pdfjs-dist', 'pdfjs-dist/build/pdf.worker.mjs')

  return webpackConfig
}

export const webpackConfig = buildConfig()

const path = require('node:path')
const TerserPlugin = require('terser-webpack-plugin')
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const { WebpackAssetsManifest } = require('webpack-assets-manifest')

const base = require('./webpack.config')

const EXCLUDED_BASE_PLUGINS = new Set([
  'CopyPlugin',
  'WebpackAssetsManifest',
  'MiniCssExtractPlugin',
])

module.exports = {
  ...base,
  mode: 'production',
  devtool: false,

  entry: {
    'pages/ide': './frontend/js/pages/ide.tsx',
  },

  output: {
    ...base.output,
    filename: 'js/custom-ide/[name]-[contenthash].js',
    chunkFilename: 'js/custom-ide/chunk-[id]-[contenthash].js',
  },

  optimization: {
    splitChunks: {
      chunks: 'async',
    },
    runtimeChunk: {
      name: 'runtime',
    },
    minimizer: [
      new TerserPlugin({
        parallel: 2,
        terserOptions: {
          keep_classnames: /(Error|Exception)$/,
          keep_fnames: /(Error|Exception)$/,
        },
      }),
      new CssMinimizerPlugin({
        minimizerOptions: {
          preset: ['default', { mergeLonghand: false }],
        },
      }),
    ],
  },

  plugins: [
    ...(base.plugins || []).filter(
      plugin => !EXCLUDED_BASE_PLUGINS.has(plugin?.constructor?.name)
    ),
    new MiniCssExtractPlugin({
      filename: 'stylesheets/custom-ide/[name]-[contenthash].css',
      chunkFilename: 'stylesheets/custom-ide/chunk-[id]-[contenthash].css',
    }),
    new WebpackAssetsManifest({
      entrypoints: true,
      publicPath: true,
      output: 'js/custom-ide/manifest.json',
    }),
  ],
}

const fs = require('fs')
const merge = require('webpack-merge')
const TerserPlugin = require('terser-webpack-plugin')
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const SentryPlugin = require('@sentry/webpack-plugin')
const RemoveFilesPlugin = require('remove-files-webpack-plugin')

const base = require('./webpack.config')

// Use "smart" merge: attempts to combine loaders targeting the same file type,
// overriding the base config
module.exports = merge.smart(
  base,
  {
    mode: 'production',

    // Enable a full source map. Generates a comment linking to the source map
    devtool: 'source-map',

    output: {
      // Override filename to include hash for immutable caching
      filename: 'js/[name]-[chunkhash].js'
    },

    module: {
      rules: [
        {
          // Override base font loading to add hash to filename so that we can
          // use "immutable" caching
          test: /\.(woff|woff2)$/,
          use: [
            {
              loader: 'file-loader',
              options: {
                outputPath: 'fonts',
                publicPath: '/fonts/',
                name: '[name]-[hash].[ext]'
              }
            }
          ]
        }
      ]
    },

    optimization: {
      // Minify JS (with Terser) and CSS (with cssnano)
      minimizer: [new TerserPlugin(), new OptimizeCssAssetsPlugin()]
    },

    plugins: [
      // Extract CSS to a separate file (rather than inlining to a <style> tag)
      new MiniCssExtractPlugin({
        // Output to public/stylesheets directory and append hash for immutable
        // caching
        filename: 'stylesheets/[name]-[chunkhash].css'
      })
    ]
  },
  // Conditionally merge in Sentry plugins
  generateSentryConfig()
)

/*
 * If Sentry secrets file exists, then configure SentryPlugin to upload source
 * maps to Sentry
 */
function generateSentryConfig() {
  // Only upload if the Sentry secrets file is available and on master branch
  if (
    fs.existsSync('./.sentryclirc') &&
    process.env['BRANCH_NAME'] === 'master'
  ) {
    console.log('Sentry secrets file found. Uploading source maps to Sentry')
    return {
      plugins: [
        new SentryPlugin({
          release: process.env['SENTRY_RELEASE'],
          include: './public/js',
          ignore: ['ace-1.4.5', 'cmaps', 'libs']
        }),

        // After uploading source maps to Sentry, delete them. Some of the
        // source maps are of proprietary code and so we don't want to make them
        // publicly available
        new RemoveFilesPlugin({
          after: {
            test: [
              {
                folder: './public/js',
                method: filePath => /\.map$/.test(filePath)
              }
            ]
          }
        })
      ]
    }
  } else {
    console.log(
      'Sentry secrets file not found. NOT uploading source maps to Sentry'
    )
    return {}
  }
}

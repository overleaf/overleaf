const path = require('path')
const merge = require('webpack-merge')
const CopyPlugin = require('copy-webpack-plugin')

const base = require('./webpack.config')
const PackageVersions = require('./app/src/infrastructure/PackageVersions')

module.exports = merge(base, {
  mode: 'production',

  // Enable a full source map. Generates a comment linking to the source map
  devtool: 'source-map',

  output: {
    // Override output path to minjs dir
    path: path.join(__dirname, '/public/minjs'),

    // Override filename to include hash for immutable caching
    filename: '[name]-[chunkhash].js',

    publicPath: '/minjs/'
  },

  plugins: [
    // Copy vendored dependencies to minjs directory as these are directly
    // loaded in a script tag by instead of being part of the webpack build
    new CopyPlugin([
      {
        from: 'public/js/libs/angular-1.6.4.min.js',
        to: 'libs/angular-1.6.4.min.js'
      },
      {
        from: 'public/js/libs/angular-1.6.4.min.js.map',
        to: 'libs/angular-1.6.4.min.js.map'
      },
      {
        from: 'public/js/libs/jquery-1.11.1.min.js',
        to: 'libs/jquery-1.11.1.min.js'
      },
      {
        from: 'public/js/libs/jquery-1.11.1.min.js.map',
        to: 'libs/jquery-1.11.1.min.js.map'
      },
      {
        from: 'public/js/libs/mathjax',
        to: 'libs/mathjax'
      },
      {
        from: 'public/js/libs/sigma-master',
        to: 'libs/sigma-master'
      },
      {
        from: `public/js/ace-${PackageVersions.version.ace}/`,
        to: `ace-${PackageVersions.version.ace}/`
      }
    ])
  ]
})

const merge = require('webpack-merge')

const base = require('./webpack.config')

module.exports = merge(base, {
  mode: 'development',

  // Karma configures entry & output for us, so disable these
  entry: null,
  output: null
})

const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const { merge } = require('webpack-merge')

const base = require('./webpack.config')

const config = merge(base, {
  mode: 'development',

  plugins: [new MiniCssExtractPlugin()],
})

// Karma configures entry & output for us, so disable these
delete config.entry
delete config.output

module.exports = config

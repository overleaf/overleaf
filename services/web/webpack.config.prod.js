const path = require('path')
const merge = require('webpack-merge')

const base = require('./webpack.config')

module.exports = merge(base, {
  mode: 'production',

  devtool: false,

  output: {
    // Override output path to minjs dir
    path: path.join(__dirname, '/public/minjs/es')
  }
})

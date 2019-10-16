const path = require('path')
const merge = require('webpack-merge')

const base = require('./webpack.config')

module.exports = merge(base, {
  mode: 'development',

  // Enable source maps for dev (fast compilation, slow runtime)
  devtool: 'cheap-module-eval-source-map',

  output: {
    publicPath: '/js/'
  },

  devServer: {
    // Disable webpack dev server auto-reload
    inline: false,

    // Expose dev server as localhost with dev box
    host: '0.0.0.0',

    // Webpack-rails default port for webpack-dev-server
    port: 3808,

    // Allow CORS
    headers: {
      'Access-Control-Allow-Origin': '*'
    },

    // Serve all content from public via webpack. This allows for serving assets
    // not (currently) bundled with webpack to be served as normal scripts
    contentBase: path.join(__dirname, 'public'),

    // Customise output to the (node) console
    stats: {
      colors: true, // Enable some coloured highlighting
      // Hide some overly verbose output
      performance: false, // Disable as code is uncompressed in dev mode
      hash: false,
      version: false,
      chunks: false,
      modules: false,
      // Hide cmaps from asset output
      excludeAssets: [/cmap/]
    }
  }
})

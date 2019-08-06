const merge = require('webpack-merge')

const base = require('./webpack.config')

module.exports = merge(base, {
  mode: 'development',

  // Enable source maps for dev (fast compilation, slow runtime)
  devtool: 'cheap-module-eval-source-map',

  output: {
    publicPath: '/public/js/es/'
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

    // Customise output to the (node) console
    stats: {
      colors: true, // Enable some coloured highlighting
      timings: true, // Show build timing info
      assets: true, // Show output bundles
      warnings: true, // Show build warnings
      // Hide some overly verbose output
      hash: false,
      version: false,
      chunks: false
    }
  },

  // Disable performance budget warnings as code is uncompressed in dev mode
  performance: {
    hints: false
  }
})

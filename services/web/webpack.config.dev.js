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
    port: 3808,

    // Customise output to the (node) console
    stats: {
      colors: true, // Enable some coloured highlighting
      // Hide some overly verbose output
      performance: false, // Disable as code is uncompressed in dev mode
      hash: false,
      version: false,
      chunks: false,
      modules: false,
      // Hide copied assets from output
      excludeAssets: [/^ace/, /^libs/, /^cmaps/]
    }
  }
})

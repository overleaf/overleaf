const webpack = require('webpack')
const { merge } = require('webpack-merge')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

const base = require('./webpack.config')

module.exports = merge(base, {
  mode: 'development',

  // Enable accurate source maps for dev
  devtool: 'source-map',

  // Load entrypoints without contenthash in filename
  output: {
    filename: 'js/[name].js',
  },

  // Load assets without contenthash in filename
  module: {
    rules: [
      {
        test: /\.(woff|woff2)$/,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name][ext]',
        },
      },
      {
        test: /\.(svg|gif|png|jpg|pdf)$/,
        type: 'asset/resource',
        generator: {
          filename: 'images/[name][ext]',
        },
      },
    ],
  },

  plugins: [
    // Extract CSS to a separate file (rather than inlining to a <style> tag)
    new MiniCssExtractPlugin({
      // Output to public/stylesheets directory
      filename: 'stylesheets/[name].css',
    }),

    // Disable React DevTools if DISABLE_REACT_DEVTOOLS is set to "true"
    process.env.DISABLE_REACT_DEVTOOLS === 'true' &&
      new webpack.DefinePlugin({
        __REACT_DEVTOOLS_GLOBAL_HOOK__: '({ isDisabled: true })',
      }),
  ].filter(Boolean),

  devServer: {
    // Expose dev server at www.dev-overleaf.com
    host: '0.0.0.0',
    port: 3808,
    client: {
      webSocketURL: 'auto://0.0.0.0:0/ws',
    },
    allowedHosts: '.dev-overleaf.com',
    setupMiddlewares(middlewares, devServer) {
      devServer.app.get('/status', (req, res) => res.send('webpack is up'))
      return middlewares
    },
  },

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
    excludeAssets: [/^js\/ace/, /^js\/libs/, /^js\/cmaps/],
  },
})

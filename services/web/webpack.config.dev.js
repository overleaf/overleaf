const webpack = require('webpack')
const { merge } = require('webpack-merge')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin')

process.env.REACT_REFRESH = '1'

const base = require('./webpack.config')

// if WEBPACK_ENTRYPOINTS is defined, remove any entrypoints that aren't included
if (process.env.WEBPACK_ENTRYPOINTS) {
  const entrypoints = new Set(process.env.WEBPACK_ENTRYPOINTS.split(/\s*,\s*/))
  console.log(`Building entrypoints ${[...entrypoints].join(',')}`)
  for (const entrypoint in base.entry) {
    if (!entrypoints.has(entrypoint)) {
      delete base.entry[entrypoint]
    }
  }
}

module.exports = merge(base, {
  mode: 'development',

  // Enable accurate source maps for dev
  devtool:
    process.env.CSP_ENABLED === 'true' ? 'source-map' : 'eval-source-map',

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

    new ReactRefreshWebpackPlugin({
      exclude: [
        /node_modules/, // default
        /source-editor/, // avoid crashing the source editor
      ],
      overlay: false,
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
    port: parseInt(process.env.PORT, 10) || 3808,
    client: {
      webSocketURL: 'auto://0.0.0.0:0/ws',
      overlay: process.env.DISABLE_WEBPACK_OVERLAY !== 'true',
    },
    hot: true,
    allowedHosts: '.dev-overleaf.com',
    setupMiddlewares(middlewares, devServer) {
      devServer.app.get('/status', (req, res) => res.send('webpack is up'))
      return middlewares
    },
  },

  // Customise output to the (node) console
  stats: {
    preset: 'minimal',
    colors: true,
  },
})

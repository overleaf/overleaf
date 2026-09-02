const path = require('path')
const webpack = require('webpack')
const { merge } = require('webpack-merge')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin')
const serveBuiltAssets = require('./webpack-plugins/serve-built-assets')

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

  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [
        __filename,
        path.resolve(__dirname, 'webpack.config.js'),
        path.resolve(__dirname, 'config/settings.webpack.js'),
      ],
    },
  },

  // Load entrypoints without contenthash in filename
  output: {
    filename: 'js/[name].js',
  },

  // Load assets without contenthash in filename
  module: {
    rules: [
      {
        test: /\.wasm$/,
        type: 'asset/resource',
        generator: {
          filename: 'js/[name][ext]',
        },
      },
      {
        // ONNX Runtime model files (symbol-recognition)
        test: /\.ort$/,
        type: 'asset/resource',
        generator: {
          filename: 'js/[name][ext]',
        },
      },
      {
        // The reduced onnxruntime-web wasm glue (symbol-recognition)
        test: /ort-wasm-simd-threaded\.mjs$/,
        type: 'asset/resource',
        generator: {
          filename: 'js/[name][ext]',
        },
      },
      {
        // Load fonts
        test: /\.(woff2?|ttf|otf)$/,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name][ext]',
        },
      },
      {
        // Load images and videos (static files)
        test: /\.(svg|gif|png|jpg|pdf|mp4)$/,
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

    process.env.REACT_REFRESH_ENABLED === 'true' &&
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
    allowedHosts: ['.dev-overleaf.com', 'localhost'],
    // Strong validators, so a browser that already has a chunk revalidates
    // instead of refetching it. The dev config serves unhashed filenames, so a
    // rebuild reuses the URL and changes the content - which is exactly what a
    // validator handles and max-age cannot.
    devMiddleware: { etag: 'strong', lastModified: true },
    setupMiddlewares(middlewares, devServer) {
      devServer.app.get('/status', (req, res) => res.send('webpack is up'))
      // Ahead of webpack-dev-middleware, so a repeat request for an unchanged
      // asset is answered from a prepared buffer instead of being read out of
      // the in-memory filesystem and re-hashed for its ETag every time.
      middlewares.unshift({
        name: 'serve-built-assets',
        middleware: serveBuiltAssets(devServer),
      })
      return middlewares
    },
    compress: false,
  },

  // Customise output to the (node) console
  stats: {
    preset: 'minimal',
    colors: true,
  },

  ignoreWarnings: [
    // ignore some "Can't resolve '*'" warnings for dynamically-imported optional peer dependencies
    /@ai-sdk\/provider-utils\/dist/,
  ],
})

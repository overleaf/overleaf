const fs = require('fs')
const path = require('path')
const webpack = require('webpack')
const CopyPlugin = require('copy-webpack-plugin')
const ManifestPlugin = require('webpack-manifest-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

const PackageVersions = require('./app/src/infrastructure/PackageVersions')

const MODULES_PATH = path.join(__dirname, '/modules')

// Generate a hash of entry points, including modules
const entryPoints = {
  main: './frontend/js/main.js',
  ide: './frontend/js/ide.js',
  style: './frontend/stylesheets/style.less',
  'ieee-style': './frontend/stylesheets/ieee-style.less',
  'light-style': './frontend/stylesheets/light-style.less'
}

// Attempt to load frontend entry-points from modules, if they exist
if (fs.existsSync(MODULES_PATH)) {
  fs.readdirSync(MODULES_PATH).reduce((acc, module) => {
    const entryPath = path.join(MODULES_PATH, module, '/frontend/js/index.js')
    if (fs.existsSync(entryPath)) {
      acc[module] = entryPath
    }
    return acc
  }, entryPoints)
}

module.exports = {
  // Defines the "entry point(s)" for the application - i.e. the file which
  // bootstraps the application
  entry: entryPoints,

  // Define where and how the bundle will be output to disk
  // Note: webpack-dev-server does not write the bundle to disk, instead it is
  // kept in memory for speed
  output: {
    path: path.join(__dirname, '/public'),

    // By default write into js directory
    filename: 'js/[name].js',

    // Output as UMD bundle (allows main JS to import with CJS, AMD or global
    // style code bundles
    libraryTarget: 'umd',
    // Name the exported variable from output bundle
    library: ['Frontend', '[name]']
  },

  // Define how file types are handled by webpack
  module: {
    rules: [
      {
        // Pass application JS files through babel-loader, compiling to ES5
        test: /\.js$/,
        // Only compile application files (npm and vendored dependencies are in
        // ES5 already)
        exclude: [
          /node_modules/,
          path.resolve(__dirname, 'frontend/js/vendor')
        ],
        use: [
          {
            loader: 'babel-loader',
            options: {
              // Configure babel-loader to cache compiled output so that
              // subsequent compile runs are much faster
              cacheDirectory: true
            }
          }
        ]
      },
      {
        // Wrap PDF.js worker in a Web Worker
        test: /pdf\.worker\.js$/,
        use: [
          {
            loader: 'worker-loader',
            options: {
              // Write into js directory (note: customising this is not possible
              // with pdfjs-dist/webpack auto loader)
              name: 'js/pdfjs-worker.[hash].js',
              // Override dynamically-set publicPath to explicitly use root.
              // This prevents a security problem where the Worker - normally
              // loaded from a CDN - has cross-origin issues, by forcing it to not
              // be loaded from the CDN
              publicPath: '/'
            }
          }
        ]
      },
      {
        // Pass Less files through less-loader/css-loader/mini-css-extract-
        // plugin (note: run in reverse order)
        test: /\.less$/,
        use: [
          // Allows the CSS to be extracted to a separate .css file
          { loader: MiniCssExtractPlugin.loader },
          // Resolves any CSS dependencies (e.g. url())
          { loader: 'css-loader' },
          {
            // Runs autoprefixer on CSS via postcss
            loader: 'postcss-loader',
            options: {
              // Uniquely identifies the postcss plugin (required by webpack)
              ident: 'postcss',
              plugins: [require('autoprefixer')]
            }
          },
          // Compiles the Less syntax to CSS
          { loader: 'less-loader' }
        ]
      },
      {
        // Load fonts
        test: /\.(woff|woff2)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              // Output to public/font
              outputPath: 'fonts',
              publicPath: '/fonts/',
              name: '[name].[ext]'
            }
          }
        ]
      },
      {
        // These options are necessary for handlebars to have access to helper
        // methods
        test: /\.handlebars$/,
        loader: 'handlebars-loader',
        options: {
          compat: true,
          knownHelpersOnly: false,
          runtimePath: 'handlebars/runtime'
        }
      },
      {
        // Load translations files with custom loader, to extract and apply
        // fallbacks
        test: /locales\/(\w{2}(-\w{2})?)\.json$/,
        use: [
          {
            loader: path.resolve('frontend/translations-loader.js')
          }
        ]
      },
      // Allow for injection of modules dependencies by reading contents of
      // modules directory and adding necessary dependencies
      {
        test: path.join(__dirname, 'modules/modules-main.js'),
        use: [
          {
            loader: 'val-loader'
          }
        ]
      },
      {
        test: path.join(__dirname, 'modules/modules-ide.js'),
        use: [
          {
            loader: 'val-loader'
          }
        ]
      },
      {
        // Expose jQuery and $ global variables
        test: require.resolve('jquery'),
        use: [
          {
            loader: 'expose-loader',
            options: 'jQuery'
          },
          {
            loader: 'expose-loader',
            options: '$'
          }
        ]
      },
      {
        // Expose angular global variable
        test: require.resolve('angular'),
        use: [
          {
            loader: 'expose-loader',
            options: 'angular'
          }
        ]
      }
    ]
  },
  resolve: {
    alias: {
      // Aliases for AMD modules

      // Shortcut to vendored dependencies in frontend/js/vendor/libs
      libs: path.join(__dirname, 'frontend/js/vendor/libs'),
      // Enables ace/ace shortcut
      ace: path.join(
        __dirname,
        `frontend/js/vendor/${PackageVersions.lib('ace')}`
      ),
      // fineupload vendored dependency (which we're aliasing to fineuploadER
      // for some reason)
      fineuploader: path.join(
        __dirname,
        `frontend/js/vendor/libs/${PackageVersions.lib('fineuploader')}`
      )
    }
  },

  // Split out vendored dependencies that are shared between 2 or more "real
  // bundles" (e.g. ide.js/main.js) as a separate "libraries" bundle and ensure
  // that they are de-duplicated from the other bundles. This allows the
  // libraries bundle to be independently cached (as it likely will change less
  // than the other bundles)
  optimization: {
    splitChunks: {
      cacheGroups: {
        libraries: {
          test: /[\\/]node_modules[\\/]|[\\/]frontend[\\/]js[\\/]vendor[\\/]libs[\\/]/,
          name: 'libraries',
          chunks: 'initial',
          minChunks: 2
        }
      }
    }
  },

  plugins: [
    // Generate a manifest.json file which is used by the backend to map the
    // base filenames to the generated output filenames
    new ManifestPlugin({
      // Always write the manifest file to disk (even if in dev mode, where
      // files are held in memory). This is needed because the server will read
      // this file (from disk) when building the script's url
      writeToFileEmit: true
    }),

    // Silence react messages in the dev-tools console
    new webpack.DefinePlugin({
      __REACT_DEVTOOLS_GLOBAL_HOOK__: '({ isDisabled: true })'
    }),

    // Prevent moment from loading (very large) locale files that aren't used
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /moment$/
    }),

    new CopyPlugin([
      {
        from: 'frontend/js/vendor/libs/mathjax',
        to: 'js/libs/mathjax'
      },
      {
        from: 'frontend/js/vendor/libs/sigma-master',
        to: 'js/libs/sigma-master'
      },
      {
        from: `frontend/js/vendor/ace-${PackageVersions.version.ace}/`,
        to: `js/ace-${PackageVersions.version.ace}/`
      },
      // Copy CMap files from pdfjs-dist package to build output. These are used
      // to provide support for non-Latin characters
      { from: 'node_modules/pdfjs-dist/cmaps', to: 'js/cmaps' }
    ])
  ]
}

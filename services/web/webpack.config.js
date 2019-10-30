const fs = require('fs')
const path = require('path')
const webpack = require('webpack')
const CopyPlugin = require('copy-webpack-plugin')
const ManifestPlugin = require('webpack-manifest-plugin')

const PackageVersions = require('./app/src/infrastructure/PackageVersions')

const MODULES_PATH = path.join(__dirname, '/modules')

// Generate a hash of entry points, including modules
const entryPoints = {
  main: './public/src/main.js',
  ide: './public/src/ide.js'
}

if (fs.existsSync(MODULES_PATH)) {
  fs.readdirSync(MODULES_PATH).reduce((acc, module) => {
    const entryPath = path.join(MODULES_PATH, module, '/public/src/index.js')
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
    path: path.join(__dirname, '/public/js'),

    filename: '[name].js',

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
        // Only compile application files (dependencies are in ES5 already)
        exclude: /node_modules/,
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
        // Expose underscore global variable
        test: path.join(
          __dirname,
          `public/src/vendor/libs/${PackageVersions.lib('underscore')}.js`
        ),
        use: [
          {
            loader: 'expose-loader',
            options: '_'
          }
        ]
      },
      {
        // Expose Algolia global variable
        test: path.join(
          __dirname,
          `public/src/vendor/libs/${PackageVersions.lib('algolia')}.js`
        ),
        use: [
          {
            loader: 'expose-loader',
            options: 'AlgoliaSearch'
          }
        ]
      }
    ]
  },
  resolve: {
    alias: {
      // Aliases for AMD modules

      // Vendored dependencies in public/src/vendor/libs (e.g. angular)
      libs: path.join(__dirname, 'public/src/vendor/libs'),
      // Use vendored moment (with correct version)
      moment: path.join(
        __dirname,
        `public/src/vendor/libs/${PackageVersions.lib('moment')}`
      ),
      // Enables ace/ace shortcut
      ace: path.join(
        __dirname,
        `public/src/vendor/${PackageVersions.lib('ace')}`
      ),
      // fineupload vendored dependency (which we're aliasing to fineuploadER
      // for some reason)
      fineuploader: path.join(
        __dirname,
        `public/src/vendor/libs/${PackageVersions.lib('fineuploader')}`
      )
    },
    // Define what can be imported with out an absolute or relative path. This
    // is because we need to override the default (which is just node_modules)
    // to get AMD modules in public/src to work as they do not use relative/
    // absolute paths for dependencies
    modules: [path.join(__dirname, 'public/src'), 'node_modules']
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
          test: /[\\/]node_modules[\\/]|[\\/]public[\\/]src[\\/]vendor[\\/]libs[\\/]/,
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

    // Silence warning when loading moment from vendored dependencies as it
    // attempts to load locales.js file which does not exist (but this is fine
    // as we don't want to load the large amount of locale data from moment)
    new webpack.IgnorePlugin(/^\.\/locale$/, /public\/src\/vendor\/libs/),

    // Copy CMap files from pdfjs-dist package to build output. These are used
    // to provide support for non-Latin characters
    new CopyPlugin([
      {
        from: 'public/src/vendor/libs/angular-1.6.4.min.js',
        to: 'libs/angular-1.6.4.min.js'
      },
      {
        from: 'public/src/vendor/libs/angular-1.6.4.min.js.map',
        to: 'libs/angular-1.6.4.min.js.map'
      },
      {
        from: 'public/src/vendor/libs/jquery-1.11.1.min.js',
        to: 'libs/jquery-1.11.1.min.js'
      },
      {
        from: 'public/src/vendor/libs/jquery-1.11.1.min.js.map',
        to: 'libs/jquery-1.11.1.min.js.map'
      },
      {
        from: 'public/src/vendor/libs/mathjax',
        to: 'libs/mathjax'
      },
      {
        from: 'public/src/vendor/libs/sigma-master',
        to: 'libs/sigma-master'
      },
      {
        from: `public/src/vendor/ace-${PackageVersions.version.ace}/`,
        to: `ace-${PackageVersions.version.ace}/`
      },
      { from: 'node_modules/pdfjs-dist/cmaps', to: 'cmaps' }
    ])
  ],

  // If jquery or underscore is required by another dependency *don't* include
  // in the bundle and use the relevant global variable instead
  externals: {
    jquery: '$',
    underscore: '_'
  }
}

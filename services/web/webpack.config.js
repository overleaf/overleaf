const path = require('path')
const glob = require('glob')
const webpack = require('webpack')
const CopyPlugin = require('copy-webpack-plugin')
const WebpackAssetsManifest = require('webpack-assets-manifest')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const {
  LezerGrammarCompilerPlugin,
} = require('./webpack-plugins/lezer-grammar-compiler')

const PackageVersions = require('./app/src/infrastructure/PackageVersions')
const invalidateBabelCacheIfNeeded = require('./frontend/macros/invalidate-babel-cache-if-needed')

// Make sure that babel-macros are re-evaluated after changing the modules config
invalidateBabelCacheIfNeeded()

// Generate a hash of entry points, including modules
const entryPoints = {
  tracing: './frontend/js/tracing.js',
  'bootstrap-3': './frontend/js/bootstrap-3.ts',
  'bootstrap-5': './frontend/js/bootstrap-5.ts',
  devToolbar: './frontend/js/dev-toolbar.ts',
  'ide-detached': './frontend/js/ide-detached.ts',
  marketing: './frontend/js/marketing.ts',
  'main-style': './frontend/stylesheets/main-style.less',
  'main-ieee-style': './frontend/stylesheets/main-ieee-style.less',
  'main-light-style': './frontend/stylesheets/main-light-style.less',
  'main-style-bootstrap-5':
    './frontend/stylesheets/bootstrap-5/main-style.scss',
}

// Add entrypoints for each "page"
glob
  .sync(
    path.join(__dirname, 'modules/*/frontend/js/pages/**/*.{js,jsx,ts,tsx}')
  )
  .forEach(page => {
    // in: /workspace/services/web/modules/foo/frontend/js/pages/bar.js
    // out: modules/foo/pages/bar
    const name = path
      .relative(__dirname, page)
      .replace(/frontend[/]js[/]/, '')
      .replace(/.(js|jsx|ts|tsx)$/, '')
    entryPoints[name] = './' + path.relative(__dirname, page)
  })

glob
  .sync(path.join(__dirname, 'frontend/js/pages/**/*.{js,jsx,ts,tsx}'))
  .forEach(page => {
    // in: /workspace/services/web/frontend/js/pages/marketing/homepage.js
    // out: pages/marketing/homepage
    const name = path
      .relative(path.join(__dirname, 'frontend/js/'), page)
      .replace(/.(js|jsx|ts|tsx)$/, '')
    entryPoints[name] = './' + path.relative(__dirname, page)
  })

function getModuleDirectory(moduleName) {
  const entrypointPath = require.resolve(moduleName)
  const suffix = `node_modules/${moduleName}`
  const idx = entrypointPath.indexOf(suffix)
  if (idx === -1) {
    throw new Error(`could not find Node module: ${moduleName}`)
  }
  return entrypointPath.slice(0, idx + suffix.length)
}

const mathjaxDir = getModuleDirectory('mathjax')
const pdfjsDir = getModuleDirectory('pdfjs-dist')
const dictionariesDir = getModuleDirectory('@overleaf/dictionaries')

const vendorDir = path.join(__dirname, 'frontend/js/vendor')

const MATHJAX_VERSION = require('mathjax/package.json').version
if (MATHJAX_VERSION !== PackageVersions.version.mathjax) {
  throw new Error(
    '"mathjax" version de-synced, update services/web/app/src/infrastructure/PackageVersions.js'
  )
}

const DICTIONARIES_VERSION =
  require('@overleaf/dictionaries/package.json').version
if (DICTIONARIES_VERSION !== PackageVersions.version.dictionaries) {
  throw new Error(
    '"@overleaf/dictionaries" version de-synced, update services/web/app/src/infrastructure/PackageVersions.js'
  )
}

module.exports = {
  // Defines the "entry point(s)" for the application - i.e. the file which
  // bootstraps the application
  entry: entryPoints,

  // Define where and how the bundle will be output to disk
  // Note: webpack-dev-server does not write the bundle to disk, instead it is
  // kept in memory for speed
  output: {
    path: path.join(__dirname, 'public'),

    publicPath: '/',
    workerPublicPath: '/',

    // By default write into js directory
    filename: 'js/[name]-[contenthash].js',

    // Output as UMD bundle (allows main JS to import with CJS, AMD or global
    // style code bundles
    libraryTarget: 'umd',
    // Name the exported variable from output bundle
    library: ['Frontend', '[name]'],
  },

  optimization: {
    // https://webpack.js.org/plugins/split-chunks-plugin/#splitchunkschunks
    splitChunks: {
      chunks: 'all', // allow non-async chunks to be analysed for shared modules
    },
    // https://webpack.js.org/configuration/optimization/#optimizationruntimechunk
    runtimeChunk: {
      name: 'runtime',
    },
  },

  // Define how file types are handled by webpack
  module: {
    rules: [
      {
        // Pass application JS/TS files through babel-loader,
        // transpiling to targets defined in browserslist
        test: /\.([jt]sx?|[cm]js)$/,
        // Only compile application files and specific dependencies
        // (other npm and vendored dependencies must be in ES5 already)
        exclude: [
          /node_modules\/(?!(react-dnd|chart\.js|@uppy|pdfjs-dist|react-resizable-panels)\/)/,
          vendorDir,
        ],
        use: [
          {
            loader: 'babel-loader',
            options: {
              // Configure babel-loader to cache compiled output so that
              // subsequent compile runs are much faster
              cacheDirectory: true,
              configFile: path.join(__dirname, './babel.config.json'),
              plugins: [
                process.env.REACT_REFRESH && 'react-refresh/babel',
              ].filter(Boolean),
            },
          },
        ],
        type: 'javascript/auto',
      },
      {
        test: /\.wasm$/,
        type: 'asset/resource',
        generator: {
          filename: 'js/[name]-[contenthash][ext]',
        },
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
              postcssOptions: {
                plugins: ['autoprefixer'],
              },
            },
          },
          // Compile Less off the main event loop
          {
            loader: 'thread-loader',
            options: {
              // keep workers alive for dev-server, and shut them down when not needed
              poolTimeout:
                process.env.NODE_ENV === 'development' ? 10 * 60 * 1000 : 500,
              // bring up more workers after they timed out
              poolRespawn: true,
              // limit concurrency (one per entrypoint and let the small includes queue up)
              workers: process.env.NODE_ENV === 'test' ? 1 : 6,
            },
          },
          // Compiles the Less syntax to CSS
          { loader: 'less-loader' },
        ],
      },
      {
        // Pass Sass files through sass-loader/css-loader/mini-css-extract-
        // plugin (note: run in reverse order)
        test: /\.s[ac]ss$/,
        use: [
          // Allows the CSS to be extracted to a separate .css file
          { loader: MiniCssExtractPlugin.loader },
          // Resolves any CSS dependencies (e.g. url())
          { loader: 'css-loader' },
          // Resolve relative paths sensibly in SASS
          { loader: 'resolve-url-loader' },
          {
            // Runs autoprefixer on CSS via postcss
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: ['autoprefixer'],
              },
            },
          },
          // Compile Sass off the main event loop
          {
            loader: 'thread-loader',
            options: {
              // keep workers alive for dev-server, and shut them down when not needed
              poolTimeout:
                process.env.NODE_ENV === 'development' ? 10 * 60 * 1000 : 500,
              // bring up more workers after they timed out
              poolRespawn: true,
              // limit concurrency (one per entrypoint and let the small includes queue up)
              workers: 6,
            },
          },
          // Compiles Sass to CSS
          {
            loader: 'sass-loader',
            options: { sourceMap: true }, // sourceMap: true is required for resolve-url-loader
          },
        ],
      },
      {
        // Pass CSS files through css-loader & mini-css-extract-plugin (note: run in reverse order)
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        // Load fonts
        test: /\.(woff2?|ttf|otf)$/,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name]-[contenthash][ext]',
        },
      },
      {
        // Load images (static files)
        test: /\.(svg|gif|png|jpg|pdf)$/,
        type: 'asset/resource',
        generator: {
          filename: 'images/[name]-[contenthash][ext]',
        },
      },
      {
        // These options are necessary for handlebars to have access to helper
        // methods
        test: /\.handlebars$/,
        loader: 'handlebars-loader',
        options: {
          compat: true,
          knownHelpersOnly: false,
          runtimePath: 'handlebars/runtime',
        },
      },
      {
        // Load translations files with custom loader, to extract and apply
        // fallbacks
        test: /locales\/(\w{2}(-\w{2})?)\.json$/,
        use: [
          {
            loader: path.join(__dirname, 'frontend/translations-loader.js'),
          },
        ],
      },
    ],
  },
  resolve: {
    alias: {
      // custom prefixes for import paths
      '@': path.resolve(__dirname, './frontend/js/'),
    },
    // symlinks: false, // enable this while using `npm link`
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json'],
    fallback: {
      events: require.resolve('events'),
      // for react-dnd + React 17
      'react/jsx-runtime': 'react/jsx-runtime.js',
      'react/jsx-dev-runtime': 'react/jsx-dev-runtime.js',
    },
  },

  experiments: {
    asyncWebAssembly: true,
  },

  plugins: [
    new LezerGrammarCompilerPlugin(),

    // Generate a manifest.json file which is used by the backend to map the
    // base filenames to the generated output filenames
    new WebpackAssetsManifest({
      entrypoints: true,
      publicPath: true,
      output: 'manifest.json',
    }),

    new webpack.EnvironmentPlugin({
      // Ensure that process.env.RESET_APP_DATA_TIMER is defined, to avoid an error.
      // https://github.com/algolia/algoliasearch-client-javascript/issues/756
      RESET_APP_DATA_TIMER: '120000',
      // Ensure that process.env.CYPRESS is defined (see utils/worker.js)
      CYPRESS: false,
    }),

    // Prevent moment from loading (very large) locale files that aren't used
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /moment$/,
    }),

    // Set window.$ and window.jQuery
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
    }),

    new CopyPlugin({
      patterns: [
        // Copy the required files for loading MathJax from MathJax NPM package
        // https://www.npmjs.com/package/mathjax#user-content-hosting-your-own-copy-of-the-mathjax-components
        {
          from: 'es5/tex-svg-full.js',
          to: `js/libs/mathjax-${PackageVersions.version.mathjax}/es5`,
          toType: 'dir',
          context: mathjaxDir,
        },
        {
          from: 'es5/input/tex/extensions/**/*.js',
          to: `js/libs/mathjax-${PackageVersions.version.mathjax}`,
          toType: 'dir',
          context: mathjaxDir,
        },
        {
          from: 'es5/ui/**/*',
          to: `js/libs/mathjax-${PackageVersions.version.mathjax}`,
          toType: 'dir',
          context: mathjaxDir,
        },
        {
          from: 'es5/a11y/**/*',
          to: `js/libs/mathjax-${PackageVersions.version.mathjax}`,
          toType: 'dir',
          context: mathjaxDir,
        },
        {
          from: 'es5/input/mml.js',
          to: `js/libs/mathjax-${PackageVersions.version.mathjax}/es5/input`,
          toType: 'dir',
          context: mathjaxDir,
        },
        {
          from: 'es5/sre/**/*',
          to: `js/libs/mathjax-${PackageVersions.version.mathjax}`,
          toType: 'dir',
          context: mathjaxDir,
        },
        {
          from: '*',
          to: `js/dictionaries/${PackageVersions.version.dictionaries}`,
          toType: 'dir',
          context: `${dictionariesDir}/dictionaries`,
        },
        // Copy CMap files (used to provide support for non-Latin characters),
        // fonts and images from pdfjs-dist package to build output.
        {
          from: 'cmaps',
          to: 'js/pdfjs-dist/cmaps',
          context: pdfjsDir,
        },
        {
          from: 'standard_fonts',
          to: 'fonts/pdfjs-dist',
          context: pdfjsDir,
        },
        {
          from: 'legacy/web/images',
          to: 'images/pdfjs-dist',
          context: pdfjsDir,
        },
      ],
    }),
  ],
}

const path = require('path')
const glob = require('glob')
const webpack = require('webpack')
const CopyPlugin = require('copy-webpack-plugin')
const WebpackAssetsManifest = require('webpack-assets-manifest')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

const PackageVersions = require('./app/src/infrastructure/PackageVersions')

// Generate a hash of entry points, including modules
const entryPoints = {
  main: './frontend/js/main.js',
  ide: './frontend/js/ide.js',
  'ide-detached': './frontend/js/ide-detached.js',
  marketing: './frontend/js/marketing.js',
  style: './frontend/stylesheets/style.less',
  'ieee-style': './frontend/stylesheets/ieee-style.less',
  'light-style': './frontend/stylesheets/light-style.less',
}

// ServiceWorker at /serviceWorker.js
entryPoints.serviceWorker = {
  import: './frontend/js/serviceWorker.js',
  publicPath: '/',
  filename: 'serviceWorker.js',
}

// Add entrypoints for each "page"
glob
  .sync(path.join(__dirname, 'modules/*/frontend/js/pages/**/*.js'))
  .forEach(page => {
    // in: /workspace/services/web/modules/foo/frontend/js/pages/bar.js
    // out: modules/foo/pages/bar
    const name = path
      .relative(__dirname, page)
      .replace(/frontend[/]js[/]/, '')
      .replace(/.js$/, '')
    entryPoints[name] = './' + path.relative(__dirname, page)
  })

glob.sync(path.join(__dirname, 'frontend/js/pages/**/*.js')).forEach(page => {
  // in: /workspace/services/web/frontend/js/pages/marketing/homepage.js
  // out: pages/marketing/homepage
  const name = path
    .relative(path.join(__dirname, 'frontend/js/'), page)
    .replace(/.js$/, '')
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
const aceDir = getModuleDirectory('ace-builds')

const pdfjsVersions = ['pdfjs-dist210', 'pdfjs-dist213']

const vendorDir = path.join(__dirname, 'frontend/js/vendor')

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

    // By default write into js directory
    filename: 'js/[name]-[contenthash].js',

    // Output as UMD bundle (allows main JS to import with CJS, AMD or global
    // style code bundles
    libraryTarget: 'umd',
    // Name the exported variable from output bundle
    library: ['Frontend', '[name]'],
  },

  // Define how file types are handled by webpack
  module: {
    rules: [
      {
        // Pass application JS/TS files through babel-loader, compiling to ES5
        test: /\.[j|t]sx?$/,
        // Only compile application files (npm and vendored dependencies are in
        // ES5 already)
        exclude: [/node_modules\/(?!react-dnd\/)/, vendorDir],
        use: [
          {
            loader: 'babel-loader',
            options: {
              // Configure babel-loader to cache compiled output so that
              // subsequent compile runs are much faster
              cacheDirectory: true,
              configFile: path.join(__dirname, './babel.config.json'),
            },
          },
        ],
        type: 'javascript/auto',
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
          // Compiles the Less syntax to CSS
          { loader: 'less-loader' },
        ],
      },
      {
        // Pass CSS files through css-loader & mini-css-extract-plugin (note: run in reverse order)
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        // Load fonts
        test: /\.(woff|woff2)$/,
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
      // Allow for injection of modules dependencies by reading contents of
      // modules directory and adding necessary dependencies
      {
        test: path.join(__dirname, 'modules/modules-main.js'),
        use: [
          {
            loader: 'val-loader',
          },
        ],
      },
      {
        test: path.join(__dirname, 'modules/modules-ide.js'),
        use: [
          {
            loader: 'val-loader',
          },
        ],
      },
      {
        // Expose jQuery and $ global variables
        test: require.resolve('jquery'),
        use: [
          {
            loader: 'expose-loader',
            options: {
              exposes: ['$', 'jQuery'],
            },
          },
        ],
      },
    ],
  },
  resolve: {
    alias: {
      // Aliases for AMD modules

      // Enables ace/ace shortcut
      ace: 'ace-builds/src-noconflict',
      // fineupload vendored dependency (which we're aliasing to fineuploadER
      // for some reason)
      fineuploader: path.join(
        __dirname,
        `frontend/js/vendor/libs/${PackageVersions.lib('fineuploader')}`
      ),
    },
    symlinks: false,
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    fallback: {
      events: require.resolve('events'),
    },
  },

  plugins: [
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

    // Copy the required files for loading MathJax from MathJax NPM package
    new CopyPlugin({
      patterns: [
        { from: 'MathJax.js', to: 'js/libs/mathjax', context: mathjaxDir },
        { from: 'config/**/*', to: 'js/libs/mathjax', context: mathjaxDir },
        {
          from: 'extensions/**/*',
          globOptions: {
            // https://github.com/mathjax/MathJax/issues/2403
            ignore: ['**/mathmaps/*.js'],
          },
          to: 'js/libs/mathjax',
          context: mathjaxDir,
        },
        {
          from: 'localization/en/**/*',
          to: 'js/libs/mathjax',
          context: mathjaxDir,
        },
        {
          from: 'jax/output/HTML-CSS/fonts/TeX/**/*',
          to: 'js/libs/mathjax',
          context: mathjaxDir,
        },
        {
          from: 'jax/output/HTML-CSS/**/*.js',
          to: 'js/libs/mathjax',
          context: mathjaxDir,
        },
        {
          from: 'jax/element/**/*',
          to: 'js/libs/mathjax',
          context: mathjaxDir,
        },
        { from: 'jax/input/**/*', to: 'js/libs/mathjax', context: mathjaxDir },
        {
          from: 'fonts/HTML-CSS/TeX/woff/*',
          to: 'js/libs/mathjax',
          context: mathjaxDir,
        },
        {
          from: 'libs/sigma-master',
          to: 'js/libs/sigma-master',
          context: vendorDir,
        },
        {
          from: 'src-min-noconflict',
          to: `js/ace-${PackageVersions.version.ace}/`,
          context: aceDir,
        },
        ...pdfjsVersions.flatMap(version => {
          const dir = getModuleDirectory(version)

          // Copy CMap files (used to provide support for non-Latin characters)
          // and static images from pdfjs-dist package to build output.

          return [
            { from: `cmaps`, to: `js/${version}/cmaps`, context: dir },
            {
              from: `legacy/web/images`,
              to: `images/${version}`,
              context: dir,
            },
          ]
        }),
      ],
    }),
  ],
}

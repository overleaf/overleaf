const path = require('node:path')
const webpack = require('webpack')
const TerserPlugin = require('terser-webpack-plugin')
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const { WebpackAssetsManifest } = require('webpack-assets-manifest')
const invalidateBabelCacheIfNeeded = require('./frontend/macros/invalidate-babel-cache-if-needed')

invalidateBabelCacheIfNeeded()

function getModuleDirectory(moduleName) {
  return path.dirname(require.resolve(`${moduleName}/package.json`))
}

const vendorDir = path.join(__dirname, 'frontend/js/vendor')

module.exports = {
  mode: 'production',
  devtool: false,

  entry: {
    'pages/project-list': './frontend/js/pages/project-list.tsx',
  },

  output: {
    path: path.join(__dirname, 'public'),
    publicPath: '/',
    workerPublicPath: '/',
    filename: 'js/custom-pl/[name]-[contenthash].js',
    chunkFilename: 'js/custom-pl/chunk-[id]-[contenthash].js',
  },

  optimization: {
    splitChunks: {
      chunks: 'async',
    },
    runtimeChunk: {
      name: 'runtime',
    },
    minimizer: [
      new TerserPlugin({
        parallel: 2,
        terserOptions: {
          keep_classnames: /(Error|Exception)$/,
          keep_fnames: /(Error|Exception)$/,
        },
      }),
      new CssMinimizerPlugin({
        minimizerOptions: {
          preset: ['default', { mergeLonghand: false }],
        },
      }),
    ],
  },

  module: {
    rules: [
      {
        test: /\.([jt]sx?|[cm][jt]s)$/,
        exclude: [
          /node_modules\/(?!(react-dnd|chart\.js|@uppy|@writefull|pdfjs-dist|react-resizable-panels)\/)/,
          vendorDir,
        ],
        use: [
          {
            loader: 'babel-loader',
            options: {
              cacheDirectory: path.join(__dirname, '.cache/babel-loader-pl'),
              configFile: path.join(__dirname, './babel.config.cjs'),
            },
          },
        ],
        type: 'javascript/auto',
      },
      {
        test: /\.s[ac]ss$/,
        use: [
          { loader: MiniCssExtractPlugin.loader },
          { loader: 'css-loader' },
          { loader: 'resolve-url-loader' },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: ['autoprefixer'],
              },
            },
          },
          {
            loader: 'sass-loader',
            options: { sourceMap: true },
          },
        ],
      },
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.(woff2?|ttf|otf)$/,
        type: 'asset/resource',
        generator: {
          filename: 'js/custom-pl/fonts/[name]-[contenthash][ext]',
        },
      },
      {
        test: /\.(svg|gif|png|jpg|pdf|mp4)$/,
        type: 'asset/resource',
        generator: {
          filename: 'js/custom-pl/images/[name]-[contenthash][ext]',
        },
      },
      {
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
    tsconfig: path.resolve(__dirname, 'tsconfig.json'),
    alias: {
      jquery: require.resolve('jquery'),
      'core-js': getModuleDirectory('core-js'),
      tslib: getModuleDirectory('tslib'),
      react: getModuleDirectory('react'),
      'react-dom': getModuleDirectory('react-dom'),
      zod: getModuleDirectory('zod'),
    },
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json'],
    fallback: {
      events: require.resolve('events'),
      'react/jsx-runtime': 'react/jsx-runtime.js',
      'react/jsx-dev-runtime': 'react/jsx-dev-runtime.js',
    },
  },

  plugins: [
    new MiniCssExtractPlugin({
      filename: 'stylesheets/custom-pl/[name]-[contenthash].css',
      chunkFilename: 'stylesheets/custom-pl/chunk-[id]-[contenthash].css',
    }),
    new WebpackAssetsManifest({
      entrypoints: true,
      publicPath: true,
      output: 'js/custom-pl/manifest.json',
    }),
    new webpack.EnvironmentPlugin({
      RESET_APP_DATA_TIMER: '120000',
      CYPRESS: false,
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /moment$/,
    }),
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
    }),
  ],
}

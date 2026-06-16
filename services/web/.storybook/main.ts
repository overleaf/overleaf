// This file has been automatically migrated to valid ESM format by Storybook.
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { defineMain } from '@storybook/react-webpack5/node'
import path, { dirname } from 'node:path'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)

const rootDir = path.resolve(__dirname, '..')

// NOTE: must be set before webpack config is imported
process.env.OVERLEAF_CONFIG = path.join(rootDir, 'config/settings.webpack.js')

function getAbsolutePath(value: string): any {
  return path.dirname(require.resolve(path.join(value, 'package.json')))
}

// Make sure that babel-macros are re-evaluated after changing the modules config
// Import this after setting process.env.OVERLEAF_CONFIG
const invalidateBabelCacheIfNeeded = require('../frontend/macros/invalidate-babel-cache-if-needed')
invalidateBabelCacheIfNeeded()

export default defineMain({
  core: {
    disableTelemetry: true,
  },

  staticDirs: [path.join(rootDir, 'public')],

  stories: [
    path.join(rootDir, 'frontend/stories/**/*.stories.{js,jsx,ts,tsx}'),
    path.join(rootDir, 'modules/**/stories/**/*.stories.{js,jsx,ts,tsx}'),
    path.join(rootDir, 'frontend/stories/**/*.mdx'),
    path.join(rootDir, 'modules/**/stories/**/*.mdx'),
  ],

  addons: [
    getAbsolutePath('@storybook/addon-links'),
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-designs'),
    getAbsolutePath('@storybook/addon-webpack5-compiler-babel'),
    {
      name: getAbsolutePath('@storybook/addon-styling-webpack'),
      options: {
        rules: [
          {
            test: /\.css$/,
            use: [
              { loader: MiniCssExtractPlugin.loader },
              { loader: 'css-loader' },
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
              // Compiles Sass to CSS
              {
                loader: 'sass-loader',
                options: { sourceMap: true }, // sourceMap: true is required for resolve-url-loader
              },
            ],
          },
        ],
        plugins: [new MiniCssExtractPlugin()],
      },
    },
    getAbsolutePath('@storybook/addon-docs'),
  ],

  framework: {
    name: getAbsolutePath('@storybook/react-webpack5'),
    options: {},
  },

  babel: (options: Record<string, any>) => {
    return {
      ...options,
      plugins: [
        ['@babel/plugin-proposal-decorators', { legacy: true }],
        // ensure that TSX files are transformed before other plugins run
        ['@babel/plugin-transform-typescript', { isTSX: true }],
        ...(options.plugins ?? []),
      ],
    }
  },

  webpackFinal: storybookConfig => {
    return {
      ...storybookConfig,
      resolve: {
        ...storybookConfig.resolve,
        fallback: {
          ...storybookConfig.resolve?.fallback,
          fs: false,
          os: false,
          module: false,
          tty: require.resolve('tty-browserify'),
        },
        extensions: ['.js', '.jsx', '.mjs', '.ts', '.tsx', '.json'],
        alias: {
          ...storybookConfig.resolve?.alias,
          // custom prefixes for import paths
          '@': path.join(rootDir, 'frontend/js/'),
          '@ol-types': path.join(rootDir, 'types/'),
          '@ol-storybook': path.join(rootDir, '.storybook/'),
          '@wf': path.join(
            rootDir,
            'modules/writefull/frontend/js/integration/src/'
          ),
        },
      },
      module: {
        ...storybookConfig.module,
        rules: (storybookConfig.module?.rules ?? []).concat(
          {
            test: /\.wasm$/,
            type: 'asset/resource',
            generator: {
              filename: 'js/[name]-[contenthash][ext]',
            },
          },
          {
            // Disable webpack's `new URL()` processing for pdfjs-dist worker
            // files, so that webpack does not try to resolve qcms_bg.wasm and
            // openjpeg.wasm (which live in pdfjs-dist/wasm/, not build/).
            // The main webpack build relies on a `/* webpackIgnore: true */`
            // comment (via yarn patch) to achieve the same effect, but
            // storybook's babel pipeline may strip comments from the 1.9 MB
            // worker file (babel `compact: "auto"` removes comments for files
            // > 500 KB), so we disable URL parsing for these files instead.
            test: /pdfjs-dist.*pdf\.worker.*\.m?js$/,
            parser: { javascript: { url: false } },
          }
        ),
      },
    }
  },
})

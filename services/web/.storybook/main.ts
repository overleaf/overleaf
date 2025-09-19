import type { StorybookConfig } from '@storybook/react-webpack5'
import path from 'node:path'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'

const rootDir = path.resolve(__dirname, '..')

// NOTE: must be set before webpack config is imported
process.env.OVERLEAF_CONFIG = path.join(rootDir, 'config/settings.webpack.js')

function getAbsolutePath(value: string): any {
  return path.dirname(require.resolve(path.join(value, 'package.json')))
}

const config: StorybookConfig = {
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
    getAbsolutePath('@storybook/addon-essentials'),
    getAbsolutePath('@storybook/addon-interactions'),
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
  ],
  framework: {
    name: getAbsolutePath('@storybook/react-webpack5'),
    options: {},
  },
  docs: {
    autodocs: 'tag',
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
          '@wf': path.join(
            rootDir,
            'modules/writefull/frontend/js/integration/src/'
          ),
        },
      },
      module: {
        ...storybookConfig.module,
        rules: (storybookConfig.module?.rules ?? []).concat({
          test: /\.wasm$/,
          type: 'asset/resource',
          generator: {
            filename: 'js/[name]-[contenthash][ext]',
          },
        }),
      },
    }
  },
}
export default config

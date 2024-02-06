import type { StorybookConfig } from '@storybook/react-webpack5'
import path from 'node:path'

const rootDir = path.resolve(__dirname, '..')

// NOTE: must be set before webpack config is imported
process.env.OVERLEAF_CONFIG = path.join(rootDir, 'config/settings.webpack.js')

const config: StorybookConfig = {
  core: {
    disableTelemetry: true,
  },
  staticDirs: [path.join(rootDir, 'public')],
  stories: [
    path.join(rootDir, 'frontend/stories/**/*.stories.{js,jsx,ts,tsx}'),
    path.join(rootDir, 'modules/**/stories/**/*.stories.{js,jsx,ts,tsx}'),
  ],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
  ],
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  babel: options => {
    return {
      ...options,
      plugins: [
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
        },
        extensions: ['.js', '.jsx', '.mjs', '.ts', '.tsx', '.json'],
        alias: {
          ...storybookConfig.resolve?.alias,
          // custom prefixes for import paths
          '@': path.join(rootDir, 'frontend/js/'),
        },
      },
    }
  },
}
export default config

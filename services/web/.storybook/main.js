const path = require('path')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

// NOTE: must be set before webpack config is imported
process.env.SHARELATEX_CONFIG = path.resolve(
  __dirname,
  '../config/settings.webpack.js'
)

const customConfig = require('../webpack.config.dev')

module.exports = {
  staticDirs: ['../public'],
  stories: [
    '../frontend/stories/**/*.stories.{js,ts,tsx}',
    '../modules/**/stories/**/*.stories.{js,ts,tsx}',
  ],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  webpackFinal: storybookConfig => {
    const rules = [
      ...storybookConfig.module.rules,
      {
        test: /\.worker\.js$/,
        use: 'worker-loader',
      },
    ]

    return {
      ...storybookConfig,
      module: {
        ...storybookConfig.module,
        rules,
      },
    }
  },
}

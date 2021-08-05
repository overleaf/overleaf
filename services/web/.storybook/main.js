const path = require('path')

// NOTE: must be set before webpack config is imported
process.env.SHARELATEX_CONFIG = path.resolve(
  __dirname,
  '../config/settings.webpack.js'
)

const customConfig = require('../webpack.config.dev')

module.exports = {
  stories: [
    '../frontend/stories/**/*.stories.js',
    '../modules/**/stories/**/*.stories.js',
  ],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  webpackFinal: storybookConfig => {
    // Combine Storybook's webpack loaders with our webpack loaders
    const rules = [
      // Filter out the Storybook font file loader, which overrides our font
      // file loader causing the font to fail to load
      ...storybookConfig.module.rules.filter(
        rule => !rule.test.toString().includes('woff')
      ),
      // Replace the less rule, adding to-string-loader
      // Filter out the MiniCSS extraction, which conflicts with the built-in CSS loader
      ...customConfig.module.rules.filter(
        rule =>
          !rule.test.toString().includes('less') &&
          !rule.test.toString().includes('css')
      ),
      {
        test: /\.less$/,
        use: ['to-string-loader', 'css-loader', 'less-loader'],
      },
    ]

    // Combine Storybook's webpack plugins with our webpack plugins
    const plugins = [...storybookConfig.plugins, ...customConfig.plugins]

    return {
      ...storybookConfig,
      module: {
        ...storybookConfig.module,
        rules,
      },
      plugins,
    }
  },
}

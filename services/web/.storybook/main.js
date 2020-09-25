const customConfig = require('../webpack.config.dev')

module.exports = {
  stories: ['../frontend/stories/**/*.stories.js'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  webpackFinal: storybookConfig => {
    // Combine Storybook's webpack loaders with our webpack loaders
    const rules = [
      // Filter out the Storybook font file loader, which overrides our font
      // file loader causing the font to fail to load
      ...storybookConfig.module.rules.filter(
        rule => !rule.test.toString().includes('woff')
      ),
      ...customConfig.module.rules
    ]

    // Combine Storybook's webpack plugins with our webpack plugins
    const plugins = [...storybookConfig.plugins, ...customConfig.plugins]

    return {
      ...storybookConfig,
      module: {
        ...storybookConfig.module,
        rules
      },
      plugins
    }
  }
}

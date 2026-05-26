const { merge } = require('webpack-merge')

const base = require('./webpack.config.dev')

module.exports = merge(base, {
  devServer: {
    allowedHosts: 'auto',
    devMiddleware: {
      index: false,
    },
    proxy: [
      {
        context: '/socket.io/**',
        target: 'http://real-time:3026',
        ws: true,
      },
      {
        // AI session proxy: forwards to code-server through web. Has to be
        // matched BEFORE the .js/.css/.json exclusion below — otherwise
        // webpack-dev-server eats code-server's static asset requests and
        // returns 404, leaving the iframe blank. ws: true also covers the
        // editor's WebSocket upgrade.
        context: '/ai/session/**',
        target: 'http://web:3000',
        ws: true,
      },
      {
        context: ['!**/*.js', '!**/*.css', '!**/*.json'],
        target: 'http://web:3000',
      },
    ],
  },
})

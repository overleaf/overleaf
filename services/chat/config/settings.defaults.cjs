const http = require('node:http')
const https = require('node:https')

http.globalAgent.keepAlive = false
https.globalAgent.keepAlive = false

module.exports = {
  internal: {
    chat: {
      host: process.env.LISTEN_ADDRESS || '127.0.0.1',
      port: 3010,
    },
  },

  apis: {
    web: {
      url: `http://${process.env.WEB_HOST || '127.0.0.1'}:${
        process.env.WEB_PORT || 3000
      }`,
      user: process.env.WEB_API_USER || 'overleaf',
      pass: process.env.WEB_API_PASSWORD || 'password',
    },
  },

  mongo: {
    url:
      process.env.MONGO_CONNECTION_STRING ||
      `mongodb://${process.env.MONGO_HOST || '127.0.0.1'}/sharelatex`,
    options: {
      monitorCommands: true,
    },
  },
}

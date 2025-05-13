const http = require('node:http')
const https = require('node:https')
const stream = require('node:stream')

// TODO(24011): remove this after node 22 update
stream.setDefaultHighWaterMark(false, 64 * 1024)
http.globalAgent.maxSockets = 300
http.globalAgent.keepAlive = false
https.globalAgent.keepAlive = false

module.exports = {
  internal: {
    contacts: {
      port: 3036,
      host: process.env.LISTEN_ADDRESS || '127.0.0.1',
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

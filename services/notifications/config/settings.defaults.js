const stream = require('node:stream')

// TODO(24011): remove this after node 22 update
stream.setDefaultHighWaterMark(false, 64 * 1024)

module.exports = {
  internal: {
    notifications: {
      port: 3042,
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

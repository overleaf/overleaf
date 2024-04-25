const http = require('http')
http.globalAgent.maxSockets = 300

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

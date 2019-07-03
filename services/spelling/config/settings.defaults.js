const Path = require('path')

module.exports = {
  internal: {
    spelling: {
      port: 3005,
      host: process.env['LISTEN_ADDRESS'] || 'localhost'
    }
  },

  mongo: {
    url:
      process.env['MONGO_CONNECTION_STRING'] ||
      `mongodb://${process.env['MONGO_HOST'] || 'localhost'}/sharelatex`
  },

  cacheDir: Path.resolve('cache'),

  healthCheckUserId: '53c64d2fd68c8d000010bb5f',

  sentry: {
    dsn: process.env.SENTRY_DSN
  }
}

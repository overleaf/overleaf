const Path = require('path')

module.exports = {
  internal: {
    spelling: {
      port: 3005,
      host: process.env.LISTEN_ADDRESS || 'localhost',
    },
  },

  mongo: {
    options: {
      useUnifiedTopology:
        (process.env.MONGO_USE_UNIFIED_TOPOLOGY || 'true') === 'true',
    },
    url:
      process.env.MONGO_CONNECTION_STRING ||
      `mongodb://${process.env.MONGO_HOST || 'localhost'}/sharelatex`,
  },

  cacheDir: Path.resolve('cache'),

  healthCheckUserId: '53c64d2fd68c8d000010bb5f',

  ignoredMisspellings: process.env.IGNORED_MISSPELLINGS
    ? process.env.IGNORED_MISSPELLINGS.split(',')
    : [
        'Overleaf',
        'overleaf',
        'ShareLaTeX',
        'sharelatex',
        'LaTeX',
        'http',
        'https',
        'www',
      ],

  sentry: {
    dsn: process.env.SENTRY_DSN,
  },
}

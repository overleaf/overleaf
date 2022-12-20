const Path = require('path')

module.exports = {
  internal: {
    spelling: {
      port: 3005,
      host: process.env.LISTEN_ADDRESS || 'localhost',
    },
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

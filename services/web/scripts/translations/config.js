let userOptions
try {
  userOptions = require('../../data/onesky.json')
} catch (err) {
  if (!process.env.ONE_SKY_PUBLIC_KEY) {
    console.error(
      'Cannot detect onesky credentials.\n\tDevelopers: see the docs at',
      'https://github.com/overleaf/developer-manual/blob/master/code/translations.md#testing-translations-scripts',
      '\n\tOps: environment variable ONE_SKY_PUBLIC_KEY is not set'
    )
    process.exit(1)
  }
}

function withAuth(options) {
  return Object.assign(
    options,
    {
      apiKey: process.env.ONE_SKY_PUBLIC_KEY,
      secret: process.env.ONE_SKY_PRIVATE_KEY,
      projectId: '25049'
    },
    userOptions
  )
}

module.exports = {
  withAuth
}

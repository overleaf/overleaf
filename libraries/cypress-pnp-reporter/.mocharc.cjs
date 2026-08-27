let reporterOptions = {}
if (process.env.CI) {
  reporterOptions = {
    reporter: require.resolve('mocha-multi-reporters'),
    'reporter-options': ['configFile=./test/mocha-multi-reporters.cjs'],
  }
}
const all = {
  require: 'test/setup.js',
  ...reporterOptions,
}

module.exports = all

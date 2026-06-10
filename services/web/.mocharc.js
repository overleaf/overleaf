let reporterOptions = {}
if (process.env.CI && process.env.JUNIT_ROOT_SUITE_NAME) {
  reporterOptions = {
    reporter: require.resolve('mocha-multi-reporters'),
    'reporter-options': ['configFile=./test/mocha-multi-reporters.js'],
  }
}
module.exports = reporterOptions

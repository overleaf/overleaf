module.exports = {
  reporterEnabled: 'spec, mocha-junit-reporter',
  mochaJunitReporterReporterOptions: {
    mochaFile: `reports/junit-${process.env.CYPRESS_SHARD}-[suiteFilename].xml`,
    includePending: true,
    jenkinsMode: true,
    jenkinsClassnamePrefix: 'Server Pro E2E tests',
    rootSuiteTitle: 'Server Pro E2E tests',
  },
}

module.exports = {
  reporterEnabled: 'spec, mocha-junit-reporter',
  mochaJunitReporterReporterOptions: {
    mochaFile: 'data/reports/junit-mocha-[hash]-[suiteFilename].xml',
    includePending: true,
    jenkinsMode: true,
    jenkinsClassnamePrefix: process.env.MOCHA_ROOT_SUITE_NAME,
    rootSuiteTitle: process.env.MOCHA_ROOT_SUITE_NAME,
  },
}

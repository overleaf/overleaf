module.exports = {
  reporterEnabled: 'spec, mocha-junit-reporter',
  mochaJunitReporterReporterOptions: {
    mochaFile: `reports/junit-mocha-${process.env.TEST_NAME_PATTERN}.xml`,
    includePending: true,
    jenkinsMode: true,
    output: true,
  },
}

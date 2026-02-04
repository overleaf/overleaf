module.exports = {
  reporterEnabled: 'spec, mocha-junit-reporter',
  mochaJunitReporterReporterOptions: {
    mochaFile: `data/reports/junit-mocha-${process.env.JUNIT_ROOT_SUITE_NAME}-${process.env.MODULE_NAME}.xml`,
    includePending: true,
    jenkinsMode: true,
    jenkinsClassnamePrefix: process.env.JUNIT_ROOT_SUITE_NAME,
    rootSuiteTitle: process.env.JUNIT_ROOT_SUITE_NAME,
    outputs: true,
  },
}

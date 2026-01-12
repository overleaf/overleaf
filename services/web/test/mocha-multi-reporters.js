module.exports = {
  reporterEnabled: 'spec, mocha-junit-reporter',
  mochaJunitReporterReporterOptions: {
    mochaFile: `data/reports/junit-mocha-${process.env.MOCHA_ROOT_SUITE_NAME}-${process.env.MODULE_NAME}.xml`,
    includePending: true,
    jenkinsMode: true,
    jenkinsClassnamePrefix: process.env.MOCHA_ROOT_SUITE_NAME,
    rootSuiteTitle: process.env.MOCHA_ROOT_SUITE_NAME,
    outputs: true,
  },
}

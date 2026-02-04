module.exports = {
  reporterEnabled: 'spec, mocha-junit-reporter',
  mochaJunitReporterReporterOptions: {
    mochaFile: `reports/junit-mocha-${process.env.MOCHA_GREP}.xml`,
    includePending: true,
    jenkinsMode: true,
    output: true,
  },
}

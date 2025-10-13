const { defineConfig } = require('vitest/config')

let reporterOptions = {}
if (process.env.CI) {
  reporterOptions = {
    reporters: [
      'default',
      [
        'junit',
        {
          classnameTemplate: `Acceptance tests.{filename}`,
        },
      ],
    ],
    outputFile: 'reports/junit-vitest-acceptance.xml',
  }
}
module.exports = defineConfig({
  test: {
    include: ['test/acceptance/js/**/*.test.{js,ts}'],
    isolate: false,
    ...reporterOptions,
  },
})

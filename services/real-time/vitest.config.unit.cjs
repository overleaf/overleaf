const { defineConfig } = require('vitest/config')

let reporterOptions = {}
if (process.env.CI) {
  reporterOptions = {
    reporters: [
      'default',
      [
        'junit',
        {
          classnameTemplate: `Unit tests.{filename}`,
        },
      ],
    ],
    outputFile: 'reports/junit-vitest-unit.xml',
  }
}
module.exports = defineConfig({
  test: {
    include: ['test/unit/js/**/*.test.{js,ts}'],
    setupFiles: ['./test/unit/setup.js'],
    isolate: false,
    ...reporterOptions,
  },
})

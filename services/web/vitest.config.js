const { defineConfig } = require('vitest/config')

let reporterOptions = {}
if (process.env.CI && process.env.MOCHA_ROOT_SUITE_NAME) {
  reporterOptions = {
    reporters: [
      'default',
      [
        'junit',
        {
          classnameTemplate: `${process.env.MOCHA_ROOT_SUITE_NAME}.{filename}`,
        },
      ],
    ],
    outputFile: 'data/reports/junit-vitest.xml',
  }
}
module.exports = defineConfig({
  test: {
    include: [
      'modules/*/test/unit/**/*.test.mjs',
      'test/unit/src/**/*.test.mjs',
    ],
    setupFiles: ['./test/unit/vitest_bootstrap.mjs'],
    globals: true,
    isolate: false,
    ...reporterOptions,
  },
})

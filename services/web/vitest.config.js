const { defineConfig } = require('vitest/config')

let reporterOptions = {}
if (process.env.CI && process.env.JUNIT_ROOT_SUITE_NAME) {
  reporterOptions = {
    reporters: [
      'default',
      [
        'junit',
        {
          classnameTemplate: `${process.env.JUNIT_ROOT_SUITE_NAME}.{filename}`,
        },
      ],
    ],
    outputFile: 'data/reports/junit-vitest.xml',
  }
}
module.exports = defineConfig({
  test: {
    setupFiles: ['./test/unit/bootstrap.mjs'],
    globals: true,
    isolate: false,
    passWithNoTests: true, // in case there are no tests from one project or other in a module
    projects: [
      {
        extends: true,
        test: {
          name: 'Parallel',
          include: [
            'modules/*/test/unit/**/*.test.mjs',
            'test/unit/src/**/*.test.mjs',
          ],
          sequence: {
            groupOrder: 2,
          },
          exclude: ['**/*.sequential.test.mjs'],
          fileParallelism: true,
        },
      },
      {
        extends: true,
        test: {
          name: 'Sequential',
          sequence: {
            groupOrder: 1,
          },
          include: [
            'modules/*/test/unit/**/*.sequential.test.mjs',
            'test/unit/src/**/*.sequential.test.mjs',
          ],
          fileParallelism: false,
        },
      },
    ],
    ...reporterOptions,
  },
})

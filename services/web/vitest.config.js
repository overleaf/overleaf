const { defineConfig } = require('vitest/config')

const COVERAGE_ENABLED = process.env.COVERAGE_UNIT_TESTS === 'true'

let reporterOptions = {}
if (process.env.CI && process.env.JUNIT_ROOT_SUITE_NAME) {
  reporterOptions = {
    maxWorkers: '50%',
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
    hookTimeout: COVERAGE_ENABLED ? 20_000 : 10_000,
    coverage: {
      enabled: COVERAGE_ENABLED,
      // Add 'sequential' / 'parallel' to the folder
      reportsDirectory: `data/coverage/esm-unit-${(process.env.JUNIT_ROOT_SUITE_NAME || 'all').split(' ').pop()}`,
      include: [
        'app.mjs',
        'app/**/*.{js,mjs}',
        'modules/*/index.mjs',
        'modules/*/app/src/**/*.{js,mjs}',
      ],
      exclude: ['app/src/Features/Metadata/packageMapping.mjs'],
      provider: 'istanbul',
      reporters: ['console-details', 'clover'],
      all: true,
    },
  },
})

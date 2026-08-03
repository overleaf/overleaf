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
    // Acceptance files share a single mongo instance and each runs the
    // migration bootstrap in its own `beforeAll` (see MongoHelper.ts).
    // Running files in parallel workers races two bootstrap runs against
    // the same "create the migrations collection" migration. Force
    // sequential file execution so only one bootstrap runs at a time.
    fileParallelism: false,
    testNamePattern: process.env.TEST_NAME_PATTERN || undefined,
    ...reporterOptions,
  },
})

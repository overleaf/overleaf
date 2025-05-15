const { defineConfig } = require('vitest/config')

module.exports = defineConfig({
  test: {
    include: [
      'modules/*/test/unit/**/*.test.mjs',
      'test/unit/src/**/*.test.mjs',
    ],
    setupFiles: ['./test/unit/vitest_bootstrap.mjs'],
    globals: true,
    isolate: false,
  },
})

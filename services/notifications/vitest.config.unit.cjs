const { defineConfig } = require('vitest/config')

module.exports = defineConfig({
  test: {
    include: ['test/unit/js/**/*.test.{js,ts}'],
    setupFiles: ['./test/setup.js'],
    isolate: false,
  },
})

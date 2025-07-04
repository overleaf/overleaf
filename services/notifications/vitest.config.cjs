const { defineConfig } = require('vitest/config')

module.exports = defineConfig({
  test: {
    include: ['test/unit/js/**/*.test.js'],
    setupFiles: ['./test/setup.js'],
    isolate: false,
  },
})

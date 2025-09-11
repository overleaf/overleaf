const { defineConfig } = require('vitest/config')

module.exports = defineConfig({
  test: {
    include: ['test/acceptance/js/**/*.test.{js,ts}'],
    isolate: false,
  },
})

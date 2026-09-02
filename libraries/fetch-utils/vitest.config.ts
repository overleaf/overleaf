import { defineConfig, ViteUserConfig } from 'vitest/config'

let reporterOptions: ViteUserConfig['test'] = {}
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
export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.{js,ts}'],
    setupFiles: ['./test/setup.js'],
    isolate: false,
    ...reporterOptions,
  },
})

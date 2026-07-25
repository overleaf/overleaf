import { defineConfig, globalIgnores } from 'eslint/config'
import cypress from 'eslint-plugin-cypress/flat'
import path from 'node:path'
import baseConfig from '../eslint.config.mjs'

const ROOT_DIR = path.resolve(import.meta.dirname, '..')

export default defineConfig([
  globalIgnores(['**/hotfix/', '**/develop/']),
  {
    basePath: ROOT_DIR,
    extends: baseConfig,
    languageOptions: {
      ecmaVersion: 2020,
    },
  },
  {
    // The cypress block in baseConfig has patterns rooted at the
    // monorepo root (`server-ce/test/helpers/*.ts`). When ESLint loads
    // this file (server-ce/eslint.config.mjs) as the closest config --
    // which happens when running `yarn run lint` from
    // /overleaf/server-ce/test/ -- patterns from baseConfig are
    // resolved relative to /overleaf/server-ce/, so those cross-dir
    // patterns don't match. Re-declare with paths relative to this
    // config file.
    files: [
      'test/helpers/*.ts',
      'test/cypress/support/*.{js,jsx,mjs,cjs,ts,tsx}',
      '**/*.spec.ts',
    ],
    ...cypress.configs.recommended,
  },
])

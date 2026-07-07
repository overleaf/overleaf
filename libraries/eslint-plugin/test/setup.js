import { afterAll, describe, it } from 'vitest'
import { RuleTester } from 'eslint'

// ESLint's RuleTester discovers the test framework via these hooks. The repo's
// vitest configs deliberately avoid `globals: true`, so wire them explicitly.
RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

import { fileURLToPath } from 'node:url'
import { RuleTester } from 'eslint'
import tsParser from '@typescript-eslint/parser'
import json from '@eslint/json'
import noThrowInCallback from '../../no-throw-in-callback.js'
import noRawReqAccess from '../../no-raw-req-access.js'
import preferKebabUrl from '../../prefer-kebab-url.js'
import noUnnecessaryTrans from '../../no-unnecessary-trans.js'
import shouldUnescapeTrans from '../../should-unescape-trans.js'
import noGeneratedEditorThemes from '../../no-generated-editor-themes.js'
import viDoMockValidPath from '../../require-vi-doMock-valid-path.js'
import requireCioSnakeCaseProperties from '../../require-cio-snake-case-properties.js'
import requireRelForDocsLinks from '../../require-rel-for-docs-links.js'
import noConsecutiveSpacesInLocales from '../../no-consecutive-spaces-in-locales.js'
import noStraightApostrophesInLocales from '../../no-straight-apostrophes-in-locales.js'
import frenchTypographyInLocales from '../../french-typography-in-locales.js'
import sortedKeysInLocales from '../../sorted-keys-in-locales.js'
import noMochaBefore from '../../no-mocha-before.js'

const __filename = fileURLToPath(import.meta.url)

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 'latest',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const jsonRuleTester = new RuleTester({
  plugins: { json },
  language: 'json/json',
})

ruleTester.run('prefer-kebab-url', preferKebabUrl, {
  valid: [
    { code: `app.get('/foo-bar')` },
    { code: `app.get('/foo-bar/:id')` },
    { code: `router.post('/foo-bar')` },
    { code: `router.get('/foo-bar/:id/:name/:age')` },
    { code: `webRouter.get('/foo-bar/:user_id/(ProjectName)/get-info')` },
    { code: `webApp.post('/foo-bar/:user_id/(ProjectName)/get-info')` },
    {
      code: `router.get(/^\\/download\\/project\\/([^/]*)\\/output\\/output\\.pdf$/)`,
    },
    {
      code: `webRouter.get(/^\\/project\\/([^/]*)\\/user\\/([0-9a-f]+)\\/build\\/([0-9a-f-]+)\\/output\\/(.*)$/)`,
    },
  ],
  invalid: [
    {
      code: `app.get('/fooBar')`,
      errors: [
        { message: 'Route path should be in kebab-case.', suggestions: 1 },
      ],
    },
    {
      code: `app.get('/fooBar/:id')`,
      errors: [
        { message: 'Route path should be in kebab-case.', suggestions: 1 },
      ],
    },
    {
      code: `webRouter.get('/foo_bar/:id/FooBar/:name/fooBar')`,
      errors: [
        { message: 'Route path should be in kebab-case.', suggestions: 1 },
      ],
    },
    {
      code: `router.get(/^\\/downLoad\\/pro-ject\\/([^/]*)\\/OutPut\\/out-put\\.pdf$/)`,
      errors: [
        {
          message: 'Route path should be in kebab-case.',
          suggestions: [
            {
              desc: 'Change to kebab-case: /^\\/down-load\\/pro-ject\\/([^/]*)\\/out-put\\/out-put\\.pdf$/',
              output: `router.get(/^\\/down-load\\/pro-ject\\/([^/]*)\\/out-put\\/out-put\\.pdf$/)`,
            },
          ],
        },
      ],
    },
  ],
})

ruleTester.run('no-unnecessary-trans', noUnnecessaryTrans, {
  valid: [
    { code: `<Trans i18nKey="test" components={{ strong: <strong/> }}/>` },
  ],
  invalid: [
    {
      code: `<Trans i18nKey="test" values={{ test: 'foo '}}/>`,
      errors: [{ message: `Use t('…') when there are no components` }],
    },
    {
      code: `<Trans i18nKey="test" />`,
      errors: [{ message: `Use t('…') when there are no components` }],
      output: `{t('test')}`,
    },
  ],
})

ruleTester.run('should-unescape-trans', shouldUnescapeTrans, {
  valid: [
    {
      code: `<Trans i18nKey="test" components={{ strong: <strong/> }}/>`,
    },
    {
      code: `<Trans i18nKey="test" values={{ foo: 'bar' }} components={{ strong: <strong/> }} shouldUnescape tOptions={{ interpolation: { escapeValue: true } }}/>`,
    },
  ],
  invalid: [
    {
      code: `<Trans i18nKey="test" values={{ foo: 'bar' }} components={{ strong: <strong/> }} />`,
      errors: [{ message: 'Trans with values must have shouldUnescape' }],
      output: `<Trans i18nKey="test" values={{ foo: 'bar' }}\nshouldUnescape components={{ strong: <strong/> }} />`,
    },
    {
      code: `<Trans i18nKey="test" values={{ foo: 'bar' }} components={{ strong: <strong/> }} shouldUnescape />`,
      errors: [
        {
          message:
            'Trans with shouldUnescape must have tOptions.interpolation.escapeValue',
        },
      ],
      output: `<Trans i18nKey="test" values={{ foo: 'bar' }} components={{ strong: <strong/> }} shouldUnescape\ntOptions={{ interpolation: { escapeValue: true } }} />`,
    },
  ],
})

const noGeneratedEditorThemesError =
  'EditorView.theme and EditorView.baseTheme each add CSS to the page for every instance of the theme. Store the theme in a variable and reuse it instead.'
ruleTester.run('no-generated-editor-themes', noGeneratedEditorThemes, {
  valid: [
    {
      code: `EditorView.theme({ '.cm-editor': { color: 'black' } })`,
    },
    {
      code: `const theme = EditorView.theme({ '.cm-editor': { color: 'black' } })`,
    },
  ],
  invalid: [
    {
      code: `function createTheme() { return EditorView.theme({ '.cm-editor': { color: 'black' } }) }`,
      errors: [
        {
          message: noGeneratedEditorThemesError,
        },
      ],
    },
    {
      code: `() => EditorView.theme({ '.cm-editor': { color: 'black' } })`,
      errors: [
        {
          message: noGeneratedEditorThemesError,
        },
      ],
    },
    {
      code: `class Foo { createTheme() { return EditorView.theme({ '.cm-editor': { color: 'black' } }) } }`,
      errors: [
        {
          message: noGeneratedEditorThemesError,
        },
      ],
    },
  ],
})

ruleTester.run('domock-require-valid-path', viDoMockValidPath, {
  valid: [
    {
      code: 'vi.doMock("../../require-vi-doMock-valid-path.js")',
      filename: __filename,
    },
    {
      code: 'const filename = "../../require-vi-doMock-valid-path.js"; vi.doMock(filename);',
      filename: __filename,
    },
  ],
  invalid: [
    {
      code: "vi.doMock('../../require-vi-doMock-valid-path2')",
      filename: __filename,
      errors: [
        {
          message:
            'The path "../../require-vi-doMock-valid-path2" in vi.doMock() cannot be resolved relative to the current file.',
          suggestions: [],
        },
      ],
    },
    {
      code: 'const filename = "../../require-vi-doMock-valid-path2.js"; vi.doMock(filename);',
      filename: __filename,
      errors: [
        {
          message:
            'The first argument of vi.doMock() must be (or resolve to) a string literal representing a path.',
          suggestions: [],
        },
      ],
    },
  ],
})

ruleTester.run(
  'require-cio-snake-case-properties',
  requireCioSnakeCaseProperties,
  {
    valid: [
      // updateUserAttributes with snake_case keys
      {
        code: `CustomerIoHandler.updateUserAttributes(userId, { plan_type: 'free', group_size: 10 })`,
      },
      // Modules.promises.hooks.fire with snake_case keys
      {
        code: `Modules.promises.hooks.fire('setUserProperties', userId, { plan_type: 'free', last_active: 123 })`,
      },
      // Modules.hooks.fire with snake_case keys
      {
        code: `Modules.hooks.fire('setUserProperties', userId, { plan_type: 'free' })`,
      },
      // Single-word keys are valid snake_case
      {
        code: `CustomerIoHandler.updateUserAttributes(userId, { email: 'a@b.com', role: 'admin' })`,
      },
      // Computed/dynamic keys are skipped
      {
        code: `CustomerIoHandler.updateUserAttributes(userId, { [dynamicKey]: true })`,
      },
      // Spread elements are skipped
      {
        code: `CustomerIoHandler.updateUserAttributes(userId, { ...existingAttrs })`,
      },
      // Unrelated function calls are not checked
      {
        code: `SomeOtherHandler.updateUserAttributes(userId, { camelCase: true })`,
      },
      // fire() with a different event name is not checked
      {
        code: `Modules.promises.hooks.fire('someOtherEvent', userId, { camelCase: true })`,
      },
    ],
    invalid: [
      // camelCase key in updateUserAttributes
      {
        code: `CustomerIoHandler.updateUserAttributes(userId, { planType: 'free' })`,
        errors: [
          {
            message: `Customer.io attribute 'planType' must be in snake_case.`,
          },
        ],
      },
      // kebab-case string key
      {
        code: `CustomerIoHandler.updateUserAttributes(userId, { 'plan-type': 'free' })`,
        errors: [
          {
            message: `Customer.io attribute 'plan-type' must be in snake_case.`,
          },
        ],
      },
      // PascalCase key
      {
        code: `CustomerIoHandler.updateUserAttributes(userId, { PlanType: 'free' })`,
        errors: [
          {
            message: `Customer.io attribute 'PlanType' must be in snake_case.`,
          },
        ],
      },
      // camelCase in Modules.promises.hooks.fire
      {
        code: `Modules.promises.hooks.fire('setUserProperties', userId, { planType: 'free' })`,
        errors: [
          {
            message: `Customer.io attribute 'planType' must be in snake_case.`,
          },
        ],
      },
      // camelCase in Modules.hooks.fire
      {
        code: `Modules.hooks.fire('setUserProperties', userId, { planType: 'free' })`,
        errors: [
          {
            message: `Customer.io attribute 'planType' must be in snake_case.`,
          },
        ],
      },
      // Multiple invalid keys report multiple errors
      {
        code: `CustomerIoHandler.updateUserAttributes(userId, { planType: 'free', groupSize: 10, plan_term: 'annual' })`,
        errors: [
          {
            message: `Customer.io attribute 'planType' must be in snake_case.`,
          },
          {
            message: `Customer.io attribute 'groupSize' must be in snake_case.`,
          },
        ],
      },
    ],
  }
)

const noThrowInCallbackMessage =
  'Pass the error to the callback instead of throwing in callback-based code.'
ruleTester.run('no-throw-in-callback', noThrowInCallback, {
  valid: [
    // Calling the callback with an error is fine
    { code: `function foo(cb) { cb(new Error()) }` },
    // async functions may throw (they return a rejected promise)
    { code: `async function foo(cb) { throw new Error() }` },
    // Last param not a callback name — not a callback-style function
    { code: `function foo(data) { throw new Error() }` },
    // No params at all
    { code: `function foo() { throw new Error() }` },
    // throw inside a nested non-callback function is fine
    { code: `function foo(cb) { [1].map(function() { throw new Error() }) }` },
    // throw inside a nested async arrow is fine
    { code: `function foo(cb) { [1].map(async () => { throw new Error() }) }` },
  ],
  invalid: [
    {
      code: `function foo(cb) { throw new Error() }`,
      errors: [{ message: noThrowInCallbackMessage }],
    },
    {
      code: `function foo(callback) { throw new Error() }`,
      errors: [{ message: noThrowInCallbackMessage }],
    },
    {
      code: `function foo(done) { throw new Error() }`,
      errors: [{ message: noThrowInCallbackMessage }],
    },
    {
      code: `function foo(next) { throw new Error() }`,
      errors: [{ message: noThrowInCallbackMessage }],
    },
    {
      code: `function foo(data, cb) { throw new Error() }`,
      errors: [{ message: noThrowInCallbackMessage }],
    },
    {
      code: `const foo = (cb) => { throw new Error() }`,
      errors: [{ message: noThrowInCallbackMessage }],
    },
    // throw in a nested callback-style function inside another callback function
    {
      code: `function foo(cb) { bar(function(done) { throw new Error() }) }`,
      errors: [{ message: noThrowInCallbackMessage }],
    },
  ],
})

ruleTester.run('no-raw-req-access', noRawReqAccess, {
  valid: [
    // validated access goes through parseReq
    { code: `const { params, body } = parseReq(req, schema)` },
    // allowlisted middleware reads raw input explicitly
    { code: `const { query } = getRawReqInput(req)` },
    // writes stay allowed: body parsers and middleware assign req.body
    { code: `req.body = {}` },
    { code: `req.query = parsed` },
    // other request fields are not locked
    { code: `const ua = req.headers['user-agent']` },
    { code: `const s = req.session` },
    // other objects with the same field names are fine
    { code: `const b = options.body` },
    { code: `const { body } = response` },
  ],
  invalid: [
    {
      code: `const id = req.params.project_id`,
      errors: [{ messageId: 'noRawReqAccess', data: { field: 'params' } }],
    },
    {
      code: `if (req.query.force) { doIt() }`,
      errors: [{ messageId: 'noRawReqAccess', data: { field: 'query' } }],
    },
    {
      code: `send(req.body)`,
      errors: [{ messageId: 'noRawReqAccess', data: { field: 'body' } }],
    },
    // computed string access
    {
      code: `const b = req['body']`,
      errors: [{ messageId: 'noRawReqAccess', data: { field: 'body' } }],
    },
    // destructuring reads
    {
      code: `const { body } = req`,
      errors: [{ messageId: 'noRawReqAccess', data: { field: 'body' } }],
    },
    {
      code: `const { params, query } = req`,
      errors: [
        { messageId: 'noRawReqAccess', data: { field: 'params' } },
        { messageId: 'noRawReqAccess', data: { field: 'query' } },
      ],
    },
    // compound assignment reads before writing
    {
      code: `req.body ||= {}`,
      errors: [{ messageId: 'noRawReqAccess', data: { field: 'body' } }],
    },
    // optional chaining
    {
      code: `const q = req?.query`,
      errors: [{ messageId: 'noRawReqAccess', data: { field: 'query' } }],
    },
  ],
})

ruleTester.run('require-rel-for-docs-links', requireRelForDocsLinks, {
  valid: [
    {
      code: `<a href="https://docs.overleaf.com/foo" target="_blank" rel="noopener noreferrer">x</a>`,
    },
    {
      code: `<a href="https://docs.overleaf.com/foo" target="_blank" rel="noreferrer noopener">x</a>`,
    },
    { code: `<a href="/learn/foo" target="_blank">x</a>` },
    { code: `<a href="https://docs.overleaf.com/foo">x</a>` },
    { code: `<a href="https://docs.overleaf.com/foo" target="_self">x</a>` },
    {
      code: `<OLButton href="https://docs.overleaf.com/foo" target="_blank" rel="noopener noreferrer">x</OLButton>`,
    },
    { code: `<OLButton href="https://docs.overleaf.com/foo">x</OLButton>` },
  ],
  invalid: [
    {
      code: `<a href="https://docs.overleaf.com/foo" target="_blank">x</a>`,
      errors: [
        {
          message:
            'Links to docs.overleaf.com with target="_blank" must have rel="noopener noreferrer" to prevent reverse-tabnabbing.',
        },
      ],
      output: `<a href="https://docs.overleaf.com/foo" target="_blank" rel="noopener noreferrer">x</a>`,
    },
    {
      code: `<a href="https://docs.overleaf.com/foo" target="_BLANK">x</a>`,
      errors: [
        {
          message:
            'Links to docs.overleaf.com with target="_blank" must have rel="noopener noreferrer" to prevent reverse-tabnabbing.',
        },
      ],
      output: `<a href="https://docs.overleaf.com/foo" target="_BLANK" rel="noopener noreferrer">x</a>`,
    },
    {
      code: `<a href="https://docs.overleaf.com/foo" target="_blank" rel="noopener">x</a>`,
      errors: [
        {
          message:
            'Links to docs.overleaf.com with target="_blank" must have rel="noopener noreferrer" to prevent reverse-tabnabbing.',
        },
      ],
      output: `<a href="https://docs.overleaf.com/foo" target="_blank" rel="noopener noreferrer">x</a>`,
    },
    {
      code: `<a href="https://docs.overleaf.com/foo" target="_blank" rel="noreferrer">x</a>`,
      errors: [
        {
          message:
            'Links to docs.overleaf.com with target="_blank" must have rel="noopener noreferrer" to prevent reverse-tabnabbing.',
        },
      ],
      output: `<a href="https://docs.overleaf.com/foo" target="_blank" rel="noreferrer noopener">x</a>`,
    },
    {
      code: `<OLButton href="https://docs.overleaf.com/foo" target="_blank">x</OLButton>`,
      errors: [
        {
          message:
            'Links to docs.overleaf.com with target="_blank" must have rel="noopener noreferrer" to prevent reverse-tabnabbing.',
        },
      ],
      output: `<OLButton href="https://docs.overleaf.com/foo" target="_blank" rel="noopener noreferrer">x</OLButton>`,
    },
    {
      // Boolean attribute (no value) - relAttr.value is null, must not crash the fixer.
      code: `<a href="https://docs.overleaf.com/foo" target="_blank" rel />`,
      errors: [
        {
          message:
            'Links to docs.overleaf.com with target="_blank" must have rel="noopener noreferrer" to prevent reverse-tabnabbing.',
        },
      ],
      output: `<a href="https://docs.overleaf.com/foo" target="_blank" rel="noopener noreferrer" />`,
    },
  ],
})

jsonRuleTester.run(
  'no-consecutive-spaces-in-locales',
  noConsecutiveSpacesInLocales,
  {
    valid: [
      { code: '{ "key": "one space" }' },
      { code: '{ "key": "no whitespace" }' },
    ],
    invalid: [
      {
        code: '{ "key": "two  spaces" }',
        errors: [{ messageId: 'consecutiveSpaces' }],
        output: '{ "key": "two spaces" }',
      },
      {
        code: '{ "key": "three   spaces" }',
        errors: [{ messageId: 'consecutiveSpaces' }],
        output: '{ "key": "three spaces" }',
      },
      {
        // \t then space → two consecutive whitespace chars
        code: '{ "key": "tab\\t and" }',
        errors: [{ messageId: 'consecutiveSpaces' }],
        output: '{ "key": "tab and" }',
      },
    ],
  }
)

jsonRuleTester.run(
  'no-straight-apostrophes-in-locales',
  noStraightApostrophesInLocales,
  {
    valid: [
      { code: '{ "key": "no apostrophe" }' },
      { code: '{ "key": "it’s curly" }' },
    ],
    invalid: [
      {
        code: `{ "key": "it's straight" }`,
        errors: [{ messageId: 'straightApostrophe' }],
        output: '{ "key": "it’s straight" }',
      },
    ],
  }
)

jsonRuleTester.run('sorted-keys-in-locales', sortedKeysInLocales, {
  valid: [
    { code: '{\n  "a": "1",\n  "b": "2"\n}\n' },
    { code: '{}' },
    { code: '{ "only": "one" }' },
  ],
  invalid: [
    {
      code: '{\n  "b": "2",\n  "a": "1"\n}\n',
      errors: [{ messageId: 'unsorted' }],
      output: '{\n  "a": "1",\n  "b": "2"\n}\n',
    },
  ],
})

jsonRuleTester.run('french-typography-in-locales', frenchTypographyInLocales, {
  valid: [
    { code: '{ "key": "Bonjour ?" }' },
    { code: '{ "key": "Liste :" }' },
    { code: '{ "key": "« contenu »" }' },
    { code: '{ "key": "abc 123" }' },
    { code: '{ "key": "10 %" }' },
  ],
  invalid: [
    {
      code: '{ "key": "Bonjour?" }',
      errors: 1,
      output: '{ "key": "Bonjour ?" }',
    },
    {
      code: '{ "key": "Bonjour ?" }',
      errors: 1,
      output: '{ "key": "Bonjour ?" }',
    },
    {
      code: '{ "key": "Liste:" }',
      errors: 1,
      output: '{ "key": "Liste :" }',
    },
    {
      code: '{ "key": "«contenu»" }',
      errors: 2,
      output: '{ "key": "« contenu »" }',
    },
    {
      code: '{ "key": "10%" }',
      errors: 1,
      output: '{ "key": "10 %" }',
    },
    {
      code: '{ "key": "sûr(e)" }',
      errors: [
        {
          message:
            'expected point médian "·" instead of "(e)" for inclusive writing',
          suggestions: [
            {
              desc: 'Replace "(e)" with "·e"',
              output: '{ "key": "sûr·e" }',
            },
          ],
        },
      ],
    },
  ],
})

const noMochaBeforeOptions = [
  { helperPath: 'server-ce/test/helpers/beforeWithReRunOnTestRetry' },
]

ruleTester.run('no-mocha-before', noMochaBefore, {
  valid: [
    {
      code: `beforeEach(function () { setup() })`,
      options: noMochaBeforeOptions,
    },
    {
      code: `import { beforeWithReRunOnTestRetry } from './helpers/beforeWithReRunOnTestRetry'
beforeWithReRunOnTestRetry(function () { setup() })`,
      options: noMochaBeforeOptions,
    },
    {
      // locally defined `before` is not the mocha hook
      code: `function before(fn) { fn() }
before(function () { setup() })`,
      options: noMochaBeforeOptions,
    },
  ],
  invalid: [
    {
      // rename + import added after the last existing import
      filename: 'server-ce/test/foo.spec.ts',
      code: `import { login } from './helpers/login'
before(async function () { this.timeout(1000) })`,
      options: noMochaBeforeOptions,
      errors: 1,
      output: `import { login } from './helpers/login'
import { beforeWithReRunOnTestRetry } from './helpers/beforeWithReRunOnTestRetry'
beforeWithReRunOnTestRetry(async function () { this.timeout(1000) })`,
    },
    {
      // no imports yet: import inserted at the top
      filename: 'server-ce/test/foo.spec.ts',
      code: `before(function () { setup() })`,
      options: noMochaBeforeOptions,
      errors: 1,
      output: `import { beforeWithReRunOnTestRetry } from './helpers/beforeWithReRunOnTestRetry'
beforeWithReRunOnTestRetry(function () { setup() })`,
    },
    {
      // helper already imported: rename only
      filename: 'server-ce/test/foo.spec.ts',
      code: `import { beforeWithReRunOnTestRetry } from './helpers/beforeWithReRunOnTestRetry'
before(function () { setup() })`,
      options: noMochaBeforeOptions,
      errors: 1,
      output: `import { beforeWithReRunOnTestRetry } from './helpers/beforeWithReRunOnTestRetry'
beforeWithReRunOnTestRetry(function () { setup() })`,
    },
    {
      // file inside helpers/: relative path has no directory prefix
      filename: 'server-ce/test/helpers/config.ts',
      code: `before(function () { setup() })`,
      options: noMochaBeforeOptions,
      errors: 1,
      output: `import { beforeWithReRunOnTestRetry } from './beforeWithReRunOnTestRetry'
beforeWithReRunOnTestRetry(function () { setup() })`,
    },
    {
      // two-argument mocha form: report without autofix
      filename: 'server-ce/test/foo.spec.ts',
      code: `before('named hook', function () { setup() })`,
      options: noMochaBeforeOptions,
      errors: 1,
    },
    {
      // no helperPath configured: report without autofix
      filename: 'server-ce/test/foo.spec.ts',
      code: `before(function () { setup() })`,
      errors: 1,
    },
  ],
})

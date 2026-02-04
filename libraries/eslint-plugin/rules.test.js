const { RuleTester } = require('eslint')
const preferKebabUrl = require('./prefer-kebab-url')
const noUnnecessaryTrans = require('./no-unnecessary-trans')
const shouldUnescapeTrans = require('./should-unescape-trans')
const noGeneratedEditorThemes = require('./no-generated-editor-themes')
const viDoMockValidPath = require('./require-vi-doMock-valid-path')

const ruleTester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: {
    ecmaVersion: 'latest',
    ecmaFeatures: { jsx: true },
  },
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
      errors: [{ message: 'Route path should be in kebab-case.' }],
    },
    {
      code: `app.get('/fooBar/:id')`,
      errors: [{ message: 'Route path should be in kebab-case.' }],
    },
    {
      code: `webRouter.get('/foo_bar/:id/FooBar/:name/fooBar')`,
      errors: [{ message: 'Route path should be in kebab-case.' }],
    },
    {
      code: `router.get(/^\\/downLoad\\/pro-ject\\/([^/]*)\\/OutPut\\/out-put\\.pdf$/)`,
      errors: [{ message: 'Route path should be in kebab-case.' }],
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
      code: 'vi.doMock("./require-vi-doMock-valid-path.js")',
      filename: __filename,
    },
    {
      code: 'const filename = "./require-vi-doMock-valid-path.js"; vi.doMock(filename);',
      filename: __filename,
    },
  ],
  invalid: [
    {
      code: "vi.doMock('./require-vi-doMock-valid-path2')",
      filename: __filename,
      errors: [
        {
          message:
            'The path "./require-vi-doMock-valid-path2" in vi.doMock() cannot be resolved relative to the current file.',
        },
      ],
    },
    {
      code: 'const filename = "./require-vi-doMock-valid-path2.js"; vi.doMock(filename);',
      filename: __filename,
      errors: [
        {
          message:
            'The first argument of vi.doMock() must be (or resolve to) a string literal representing a path.',
        },
      ],
    },
  ],
})

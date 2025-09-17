const fs = require('node:fs')
const path = require('node:path')
const typescript = require('typescript')

module.exports = {
  input: [
    'frontend/js/**/*.{js,jsx,ts,tsx}',
    'modules/*/frontend/js/**/*.{js,jsx,ts,tsx}',
    '!frontend/js/vendor/**',
    '!modules/writefull/frontend/js/integration/**',
  ],
  output: './',
  options: {
    sort: true,
    func: {
      list: ['t', 'phrase'],
      extensions: ['.js', '.jsx'],
    },
    trans: {
      component: 'Trans',
      i18nKey: 'i18nKey',
      defaultsKey: 'defaults',
      extensions: ['.js', '.jsx'],
      fallbackKey: false,
    },
    resource: {
      savePath: 'frontend/extracted-translations.json',
      jsonIndent: 2,
      lineEnding: '\n',
    },
  },
  // adapted from https://github.com/nucleartux/i18next-scanner-typescript/blob/master/src/index.js
  transform: function (file, enc, done) {
    const { base, ext } = path.parse(file.path)

    if (['.ts', '.tsx'].includes(ext) && !base.endsWith('.d.ts')) {
      const content = fs.readFileSync(file.path, enc)

      const { outputText } = typescript.transpileModule(content, {
        compilerOptions: { target: 'es2018', jsx: 'preserve' },
        fileName: base,
      })

      this.parser.parseTransFromString(outputText)
      this.parser.parseFuncFromString(outputText)
    }

    done()
  },
}

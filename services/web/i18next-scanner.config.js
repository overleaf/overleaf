module.exports = {
  input: [
    'frontend/js/**/*.{js,jsx}',
    'modules/**/*.{js,jsx}',
    '!frontend/js/vendor/**',
  ],
  output: './',
  options: {
    sort: true,
    func: {
      list: ['t'],
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
}

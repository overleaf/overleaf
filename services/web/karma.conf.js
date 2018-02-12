module.exports = function (config) {
  config.set({
    customLaunchers: {
      ChromeCustom: {
        base: 'ChromeHeadless',
        // We must disable the Chrome sandbox when running Chrome inside Docker
        // (Chrome's sandbox needs more permissions than Docker allows by
        // default)
        flags: ['--no-sandbox']
      }
    },
    browsers: ['ChromeCustom'],
    files: [],
    frameworks: ['requirejs', 'mocha', 'chai-sinon'],
    plugins: [
      require('karma-requirejs'),
      require('karma-mocha'),
      require('karma-chai-sinon'),
      require('karma-chrome-launcher'),
      require('karma-tap-reporter')
    ],
    reporters: ['tap']
  });
}

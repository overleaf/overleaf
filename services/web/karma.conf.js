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
    files: [
      'test/unit_frontend/js/bootstrap.js',
      // Angular must be loaded before requirejs to set up angular global
      'public/js/libs/angular-1.6.4.min.js',
      'public/js/libs/angular-mocks.js',
      'public/js/libs/jquery-1.11.1.min.js',
      // Set up requirejs
      'test/unit_frontend/js/test-main.js',
      // Include source & test files, but don't "include" them as requirejs
      // handles this for us
      { pattern: 'public/js/**/*.js', included: false },
      { pattern: 'test/unit_frontend/js/**/*.js', included: false }
    ],
    frameworks: ['requirejs', 'mocha', 'chai-sinon'],
    plugins: [
      require('karma-requirejs'),
      require('karma-mocha'),
      require('karma-chai-sinon'),
      require('karma-chrome-launcher'),
      require('karma-mocha-reporter')
    ],
    reporters: ['mocha']
  });
}

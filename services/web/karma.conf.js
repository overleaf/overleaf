const webpackConfig = require('./webpack.config.test')

module.exports = function(config) {
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
      'test/unit_frontend/bootstrap.js',
      // Include scripts that are injected into the page outside of webpack
      'public/js/libs/angular-1.6.4.min.js',
      'public/js/libs/jquery-1.11.1.min.js',

      // Allow mocking of angular
      'public/js/libs/angular-mocks.js',

      // Import all tests (see comment in the file for why this is necessary)
      'test/unit_frontend/import_tests.js',

      // Include CSS (there is some in js/libs dir)
      'public/stylesheets/**/*.css',
      'public/js/libs/**/*.css'
    ],
    middleware: ['fake-img'],
    preprocessors: {
      // Run files through webpack
      'test/unit_frontend/import_tests.js': ['webpack']
    },
    frameworks: ['mocha', 'chai-sinon'],
    // Configure webpack in the tests
    webpack: webpackConfig,
    // Configure the webpack dev server used to serve test files
    webpackMiddleware: {
      // Disable noisy CLI output
      stats: 'errors-only'
    },
    plugins: [
      require('karma-chrome-launcher'),
      require('karma-mocha'),
      require('karma-chai-sinon'),
      require('karma-webpack'),
      require('karma-mocha-reporter'),
      { 'middleware:fake-img': ['factory', fakeImgMiddlewareFactory] }
    ],
    reporters: ['mocha']
  })
}

/**
 * Handle fake images
 */
function fakeImgMiddlewareFactory() {
  return function(req, res, next) {
    if (req.originalUrl.startsWith('/fake/')) {
      return res.end('fake img response')
    }
    next()
  }
}

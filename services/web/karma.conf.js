const path = require('path')

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
      { pattern: 'test/unit_frontend/js/**/*.js', included: false },
      // Include ES test files
      'test/unit_frontend/es/**/*.js',
      'modules/**/test/unit_frontend/es/**/*.js'
    ],
    middleware: ['fake-img'],
    preprocessors: {
      // Run ES test files through webpack (which will then include source
      // files in bundle)
      'test/unit_frontend/es/**/*.js': ['webpack'],
      'modules/**/test/unit_frontend/es/**/*.js': ['webpack']
    },
    frameworks: ['requirejs', 'mocha', 'chai-sinon'],
    // Configure webpack in the tests
    webpack: {
      resolve: {
        alias: {
          // Alias Src in import pathnames to public/es
          // Cuts down on the amount of ../../ etc
          Src: path.join(__dirname, 'public/es/')
        }
      }
    },
    // Configure the webpack dev server used to serve test files
    webpackMiddleware: {
      // Disable noisy CLI output
      stats: 'errors-only'
    },
    plugins: [
      require('karma-chrome-launcher'),
      require('karma-requirejs'),
      require('karma-mocha'),
      require('karma-chai-sinon'),
      require('karma-webpack'),
      require('karma-mocha-reporter'),
      { 'middleware:fake-img': ['factory', fakeImgMiddlewareFactory] }
    ],
    reporters: ['mocha']
  });
}

/**
 * Handle fake images
 */
function fakeImgMiddlewareFactory () {
  return function (req, res, next) {
    if (req.originalUrl.startsWith('/fake/')) {
      return res.end('fake img response')
    }
    next()
  }
}
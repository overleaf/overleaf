/*
 * Bundle all test files together into a single bundle, and run tests against
 * this single bundle.
 * We are using karma-webpack to bundle our tests and the 'default' strategy is
 * to create a bundle for each test file. This isolates the tests better, but
 * causes a problem with Angular. The issue with Angular tests is because we
 * load a single global copy of Angular (see karma.conf.js) but
 * public/src/base.js is included in each bundle, meaning the Angular app is
 * initialised for each bundle when it is loaded onto the page when Karma
 * starts. This means that only the last bundle will have controllers/directives
 * registered against it, ultimately meaning that all other bundles will fail
 * because Angular cannot find the controller/directive under test.
 */

// Import from the top-level any JS files within a test/unit_frontend/src
// directory
const context = require.context(
  '../../',
  true,
  /test\/unit_frontend\/src\/.*\.js$/
)
context.keys().forEach(context)

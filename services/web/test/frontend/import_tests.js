/* global chai */

// Allow for mocking of Angular
import 'angular'
import 'angular-mocks'

/**
 * Add chai assertion for comparing CodeMirror Pos objects.
 * A deep comparison will fail because CodeMirror inserts additional properties
 * that we want to ignore.
 */
chai.Assertion.addMethod('equalPos', function(expectedPos) {
  const { line: actualLine, ch: actualCh } = this._obj
  const { line: expectedLine, ch: expectedCh } = expectedPos

  this.assert(
    actualLine === expectedLine && actualCh === expectedCh,
    `expected #{exp} to equal #{act}`,
    `expected #{exp} to not equal #{act}`,
    `Pos({ line: ${expectedLine}, ch: ${expectedCh} })`,
    `Pos({ line: ${actualLine}, ch: ${actualCh} })`
  )
})

// Mock ExposedSettings
window.ExposedSettings = {}

// Mock the file operation I18n names that are stored in the DOM
function mockFileOperationI18nNames(id, text) {
  const el = document.createElement('div')
  el.id = id
  el.innerText = text
  el.setAttribute('hidden', true)
  document.body.appendChild(el)
}
mockFileOperationI18nNames('file_action_edited_str', 'edited')
mockFileOperationI18nNames('file_action_renamed_str', 'renamed')
mockFileOperationI18nNames('file_action_created_str', 'created')
mockFileOperationI18nNames('file_action_deleted_str', 'deleted')

/*
 * Bundle all test files together into a single bundle, and run tests against
 * this single bundle.
 * We are using karma-webpack to bundle our tests and the 'default' strategy is
 * to create a bundle for each test file. This isolates the tests better, but
 * causes a problem with Angular. The issue with Angular tests is because we
 * load a single global copy of Angular (see karma.conf.js) but
 * frontend/js/base.js is included in each bundle, meaning the Angular app is
 * initialised for each bundle when it is loaded onto the page when Karma
 * starts. This means that only the last bundle will have controllers/directives
 * registered against it, ultimately meaning that all other bundles will fail
 * because Angular cannot find the controller/directive under test.
 */

// Import from the top-level any JS files within a test/frontend
// directory
const context = require.context('../../', true, /test\/frontend\/.*\.js$/)
context.keys().forEach(context)

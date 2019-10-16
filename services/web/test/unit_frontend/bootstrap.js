/* global chai */

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

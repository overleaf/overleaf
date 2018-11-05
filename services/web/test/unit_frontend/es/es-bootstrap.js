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

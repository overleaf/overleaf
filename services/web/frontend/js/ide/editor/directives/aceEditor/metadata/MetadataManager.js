/* eslint-disable
    max-len,
    no-cond-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['ace/ace'], function() {
  let MetadataManager
  const { Range } = ace.require('ace/range')

  const getLastCommandFragment = function(lineUpToCursor) {
    let m
    if ((m = lineUpToCursor.match(/(\\[^\\]+)$/))) {
      return m[1]
    } else {
      return null
    }
  }

  return (MetadataManager = class MetadataManager {
    constructor($scope, editor, element, Metadata) {
      this.$scope = $scope
      this.editor = editor
      this.element = element
      this.Metadata = Metadata
      this.debouncer = {} // DocId => Timeout

      const onChange = change => {
        if (change.remote) {
          return
        }
        if (!['remove', 'insert'].includes(change.action)) {
          return
        }
        const cursorPosition = this.editor.getCursorPosition()
        const { end } = change
        let range = new Range(end.row, 0, end.row, end.column)
        let lineUpToCursor = this.editor.getSession().getTextRange(range)
        if (
          lineUpToCursor.trim() === '%' ||
          lineUpToCursor.slice(0, 1) === '\\'
        ) {
          range = new Range(end.row, 0, end.row, end.column + 80)
          lineUpToCursor = this.editor.getSession().getTextRange(range)
        }
        const commandFragment = getLastCommandFragment(lineUpToCursor)

        const linesContainPackage = _.some(change.lines, line =>
          line.match(/^\\usepackage(?:\[.{0,80}?])?{(.{0,80}?)}/)
        )
        const linesContainReqPackage = _.some(change.lines, line =>
          line.match(/^\\RequirePackage(?:\[.{0,80}?])?{(.{0,80}?)}/)
        )
        const linesContainLabel = _.some(change.lines, line =>
          line.match(/\\label{(.{0,80}?)}/)
        )
        const linesContainMeta =
          linesContainPackage || linesContainLabel || linesContainReqPackage

        const lastCommandFragmentIsLabel =
          (commandFragment != null
            ? commandFragment.slice(0, 7)
            : undefined) === '\\label{'
        const lastCommandFragmentIsPackage =
          (commandFragment != null
            ? commandFragment.slice(0, 11)
            : undefined) === '\\usepackage'
        const lastCommandFragmentIsReqPack =
          (commandFragment != null
            ? commandFragment.slice(0, 15)
            : undefined) === '\\RequirePackage'
        const lastCommandFragmentIsMeta =
          lastCommandFragmentIsPackage ||
          lastCommandFragmentIsLabel ||
          lastCommandFragmentIsReqPack

        if (linesContainMeta || lastCommandFragmentIsMeta) {
          return this.Metadata.scheduleLoadDocMetaFromServer(this.$scope.docId)
        }
      }

      this.editor.on('changeSession', e => {
        e.oldSession.off('change', onChange)
        return e.session.on('change', onChange)
      })
    }

    getAllLabels() {
      return this.Metadata.getAllLabels()
    }

    getAllPackages() {
      return this.Metadata.getAllPackages()
    }
  })
})

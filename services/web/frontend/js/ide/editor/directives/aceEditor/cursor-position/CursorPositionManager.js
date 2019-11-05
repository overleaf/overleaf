/* eslint-disable
    max-len,
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
define([], function() {
  let CursorPositionManager
  return (CursorPositionManager = class CursorPositionManager {
    constructor($scope, adapter, localStorage) {
      this.storePositionAndLine = this.storePositionAndLine.bind(this)
      this.jumpToPositionInNewDoc = this.jumpToPositionInNewDoc.bind(this)
      this.onUnload = this.onUnload.bind(this)
      this.onCursorChange = this.onCursorChange.bind(this)
      this.onSyncToPdf = this.onSyncToPdf.bind(this)
      this.$scope = $scope
      this.adapter = adapter
      this.localStorage = localStorage
      this.$scope.$on('editorInit', this.jumpToPositionInNewDoc)

      this.$scope.$on('beforeChangeDocument', this.storePositionAndLine)

      this.$scope.$on('afterChangeDocument', this.jumpToPositionInNewDoc)

      this.$scope.$on('changeEditor', this.storePositionAndLine)

      this.$scope.$on(`${this.$scope.name}:gotoLine`, (e, line, column) => {
        if (line != null) {
          return setTimeout(() => {
            return this.adapter.gotoLine(line, column)
          }, 10)
        }
      }) // Hack: Must happen after @gotoStoredPosition

      this.$scope.$on(`${this.$scope.name}:gotoOffset`, (e, offset) => {
        if (offset != null) {
          return setTimeout(() => {
            return this.adapter.gotoOffset(offset)
          }, 10)
        }
      }) // Hack: Must happen after @gotoStoredPosition

      this.$scope.$on(`${this.$scope.name}:clearSelection`, e => {
        return this.adapter.clearSelection()
      })
    }

    storePositionAndLine() {
      this.storeCursorPosition()
      return this.storeFirstVisibleLine()
    }

    jumpToPositionInNewDoc() {
      this.doc_id =
        this.$scope.sharejsDoc != null
          ? this.$scope.sharejsDoc.doc_id
          : undefined
      return setTimeout(() => {
        return this.gotoStoredPosition()
      }, 0)
    }

    onUnload() {
      this.storeCursorPosition()
      return this.storeFirstVisibleLine()
    }

    onCursorChange() {
      return this.emitCursorUpdateEvent()
    }

    onSyncToPdf() {
      return this.$scope.$emit(`cursor:${this.$scope.name}:syncToPdf`)
    }

    storeFirstVisibleLine() {
      if (this.doc_id != null) {
        const docPosition =
          this.localStorage(`doc.position.${this.doc_id}`) || {}
        docPosition.firstVisibleLine = this.adapter.getEditorScrollPosition()
        return this.localStorage(`doc.position.${this.doc_id}`, docPosition)
      }
    }

    storeCursorPosition() {
      if (this.doc_id != null) {
        const docPosition =
          this.localStorage(`doc.position.${this.doc_id}`) || {}
        docPosition.cursorPosition = this.adapter.getCursor()
        return this.localStorage(`doc.position.${this.doc_id}`, docPosition)
      }
    }

    emitCursorUpdateEvent() {
      const cursor = this.adapter.getCursor()
      return this.$scope.$emit(`cursor:${this.$scope.name}:update`, cursor)
    }

    gotoStoredPosition() {
      if (this.doc_id == null) {
        return
      }
      const pos = this.localStorage(`doc.position.${this.doc_id}`) || {}
      this.adapter.setCursor(pos)
      return this.adapter.setEditorScrollPosition(pos)
    }
  })
})

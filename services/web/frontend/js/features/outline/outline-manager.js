import './controllers/outline-controller'
import { matchOutline, nestOutline } from './outline-parser'
import isValidTeXFile from '../../main/is-valid-tex-file'

class OutlineManager {
  constructor(ide, scope) {
    this.ide = ide
    this.scope = scope
    this.shareJsDoc = null
    this.isTexFile = false
    this.flatOutline = []
    this.outline = []
    this.highlightedLine = null
    this.ignoreNextScroll = false
    this.ignoreNextCursorUpdate = false

    scope.$on('doc:after-opened', (ev, { isNewDoc }) => {
      if (isNewDoc) {
        // if a new doc is opened a cursor updates will be triggered before the
        // content is loaded. We have to ignore it or the outline highlight
        // will be incorrect. This doesn't happen when `doc:after-opened` is
        // fired without a new doc opened.
        this.ignoreNextCursorUpdate = true
      }
      // always ignore the next scroll update so the cursor update takes
      // precedence
      this.ignoreNextScroll = true
      this.shareJsDoc = scope.editor.sharejs_doc
      this.isTexFile = isValidTeXFile(scope.editor.open_doc_name)
      this.updateOutline()
      this.broadcastChangeEvent()
    })

    scope.$on('doc:changed', () => {
      this.updateOutline()
      this.broadcastChangeEvent()
    })

    scope.$on('file-view:file-opened', () => {
      this.isTexFile = false
      this.updateOutline()
      this.broadcastChangeEvent()
    })

    scope.$on('cursor:editor:update', (event, cursorPosition) => {
      if (this.ignoreNextCursorUpdate) {
        this.ignoreNextCursorUpdate = false
        return
      }
      this.updateHighlightedLine(cursorPosition.row + 1)
      this.broadcastChangeEvent()
    })

    scope.$on('scroll:editor:update', (event, middleVisibleRow) => {
      if (this.ignoreNextScroll) {
        this.ignoreNextScroll = false
        return
      }

      this.updateHighlightedLine(middleVisibleRow + 1)
    })

    scope.$watch('editor.showRichText', () => {
      this.ignoreNextScroll = true
      this.ignoreNextCursorUpdate = true
    })
  }

  updateOutline() {
    this.outline = []
    if (this.isTexFile) {
      const content = this.ide.editorManager.getCurrentDocValue()
      if (content) {
        this.flatOutline = matchOutline(content)
        this.outline = nestOutline(this.flatOutline)
      }
    }
  }

  // set highlightedLine to the closest outline line above the editorLine
  updateHighlightedLine(editorLine) {
    let closestOutlineLine = null
    for (let lineId = 0; lineId < this.flatOutline.length; lineId++) {
      const outline = this.flatOutline[lineId]
      if (editorLine < outline.line) break // editorLine is above
      closestOutlineLine = outline.line
    }
    if (closestOutlineLine === this.highlightedLine) return
    this.highlightedLine = closestOutlineLine
    this.broadcastChangeEvent()
  }

  jumpToLine(line, syncToPdf) {
    this.ignoreNextScroll = true
    this.ide.editorManager.jumpToLine({ gotoLine: line, syncToPdf })
  }

  broadcastChangeEvent() {
    this.scope.$broadcast('outline-manager:outline-changed', {
      isTexFile: this.isTexFile,
      outline: this.outline,
      highlightedLine: this.highlightedLine,
    })
  }
}

export default OutlineManager

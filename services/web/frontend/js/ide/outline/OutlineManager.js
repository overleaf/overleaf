import './controllers/OutlineController'
import './components/OutlinePane'
import './components/OutlineRoot'
import './components/OutlineList'
import './components/OutlineItem'
import { matchOutline, nestOutline } from './OutlineParser'
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

    scope.$on('doc:after-opened', () => {
      this.ignoreNextScroll = true
      this.ignoreNextCursorUpdate = true
      this.shareJsDoc = scope.editor.sharejs_doc
      this.isTexFile = isValidTeXFile(scope.editor.open_doc_name)
      this.updateOutline()
      this.broadcastChangeEvent()
    })

    scope.$watch('openFile.name', openFileName => {
      this.isTexFile = isValidTeXFile(openFileName)
      this.updateOutline()
      this.broadcastChangeEvent()
    })

    scope.$on('doc:changed', () => {
      this.updateOutline()
      this.broadcastChangeEvent()
    })

    scope.$on('cursor:editor:update', (event, cursorPosition) => {
      if (!window.user.alphaProgram) return
      if (this.ignoreNextCursorUpdate) {
        this.ignoreNextCursorUpdate = false
        return
      }
      this.updateHighlightedLine(cursorPosition.row + 1)
      this.broadcastChangeEvent()
    })

    scope.$on('scroll:editor:update', (event, middleVisibleRow) => {
      if (!window.user.alphaProgram) return
      if (this.ignoreNextScroll) {
        this.ignoreNextScroll = false
        return
      }

      this.updateHighlightedLine(middleVisibleRow + 1)
      this.broadcastChangeEvent()
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
    this.highlightedLine = closestOutlineLine
  }

  jumpToLine(line) {
    this.ignoreNextScroll = true
    this.ide.editorManager.jumpToLine({ gotoLine: line })
  }

  broadcastChangeEvent() {
    this.scope.$broadcast('outline-manager:outline-changed', {
      isTexFile: this.isTexFile,
      outline: this.outline,
      highlightedLine: this.highlightedLine
    })
  }
}

export default OutlineManager

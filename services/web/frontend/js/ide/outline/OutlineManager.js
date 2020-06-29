import './controllers/OutlineController'
import './components/OutlinePane'
import './components/OutlineRoot'
import './components/OutlineList'
import './components/OutlineItem'
import parseOutline from './OutlineParser'
import isValidTeXFile from '../../main/is-valid-tex-file'

class OutlineManager {
  constructor(ide, scope) {
    this.ide = ide
    this.scope = scope
    this.shareJsDoc = null
    this.isTexFile = false
    this.outline = []

    scope.$watch('editor.sharejs_doc', shareJsDoc => {
      this.shareJsDoc = shareJsDoc
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
  }

  updateOutline() {
    this.outline = []
    if (this.isTexFile) {
      const content = this.ide.editorManager.getCurrentDocValue()
      if (content) {
        this.outline = parseOutline(content)
      }
    }
  }

  jumpToLine(line) {
    this.ide.editorManager.openDocId(this.shareJsDoc.doc.doc_id, {
      gotoLine: line
    })
  }

  broadcastChangeEvent() {
    this.scope.$broadcast('outline-manager:outline-changed', {
      isTexFile: this.isTexFile,
      outline: this.outline
    })
  }
}

export default OutlineManager

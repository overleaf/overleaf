import Toolbar from './toolbar'
import Main from './main'

function Editor() {
  return (
    <div className="doc-panel">
      <div className="history-header toolbar-container">
        <Toolbar />
      </div>
      <div className="doc-container">
        <Main />
      </div>
    </div>
  )
}

export default Editor

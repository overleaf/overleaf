import Toolbar from './toolbar'
import Main from './main'

function DiffView() {
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

export default DiffView

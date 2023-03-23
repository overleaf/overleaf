import ToggleSwitch from './toggle-switch'
import Main from './main'

function ChangeList() {
  return (
    <aside className="change-list">
      <div className="history-header toggle-switch-container">
        <ToggleSwitch />
      </div>
      <div className="version-list-container">
        <Main />
      </div>
    </aside>
  )
}

export default ChangeList

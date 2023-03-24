import ToggleSwitch from './toggle-switch'
import Main from './main'
import { useState } from 'react'

function ChangeList() {
  // eslint-disable-next-line no-unused-vars
  const [labelsOnly, setLabelsOnly] = useState(false)

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

import ToggleSwitch from './toggle-switch'
import AllHistoryList from './all-history-list'
import LabelsList from './labels-list'
import { useHistoryContext } from '../../context/history-context'

function ChangeList() {
  const { labelsOnly, setLabelsOnly } = useHistoryContext()

  return (
    <aside className="change-list">
      <div className="history-header history-toggle-switch-container">
        <ToggleSwitch labelsOnly={labelsOnly} setLabelsOnly={setLabelsOnly} />
      </div>
      <div
        className="history-version-list-container"
        data-history-version-list-container
      >
        {labelsOnly ? <LabelsList /> : <AllHistoryList />}
      </div>
    </aside>
  )
}

export default ChangeList

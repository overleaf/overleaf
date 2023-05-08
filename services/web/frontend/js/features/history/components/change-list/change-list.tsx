import ToggleSwitch from './toggle-switch'
import AllHistoryList from './all-history-list'
import LabelsList from './labels-list'
import { useHistoryContext } from '../../context/history-context'

function ChangeList() {
  const { error, labelsOnly, setLabelsOnly } = useHistoryContext()

  return (
    <aside className="change-list">
      <div className="history-header history-toggle-switch-container">
        {!error && (
          <ToggleSwitch labelsOnly={labelsOnly} setLabelsOnly={setLabelsOnly} />
        )}
      </div>
      {!error && (
        <div className="history-version-list-container">
          {labelsOnly ? <LabelsList /> : <AllHistoryList />}
        </div>
      )}
    </aside>
  )
}

export default ChangeList

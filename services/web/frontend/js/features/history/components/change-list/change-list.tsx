import usePersistedState from '../../../../shared/hooks/use-persisted-state'
import ToggleSwitch from './toggle-switch'
import Main from './main'
import { useHistoryContext } from '../../context/history-context'

function ChangeList() {
  const { projectId, isError } = useHistoryContext()
  const [labelsOnly, setLabelsOnly] = usePersistedState(
    `history.userPrefs.showOnlyLabels.${projectId}`,
    false
  )

  return (
    <aside className="change-list">
      <div className="history-header toggle-switch-container">
        {!isError && (
          <ToggleSwitch labelsOnly={labelsOnly} setLabelsOnly={setLabelsOnly} />
        )}
      </div>
      <div className="version-list-container">
        <Main />
      </div>
    </aside>
  )
}

export default ChangeList

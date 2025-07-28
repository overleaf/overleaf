import ToggleSwitch from './toggle-switch'
import AllHistoryList from './all-history-list'
import LabelsList from './labels-list'
import { useHistoryContext } from '../../context/history-context'
import { useTranslation } from 'react-i18next'

function ChangeList() {
  const { labelsOnly, setLabelsOnly } = useHistoryContext()
  const { t } = useTranslation()

  return (
    <aside className="change-list" aria-label={t('project_history_labels')}>
      <div className="history-header history-toggle-switch-container">
        <ToggleSwitch labelsOnly={labelsOnly} setLabelsOnly={setLabelsOnly} />
      </div>
      <div className="history-version-list-container">
        {labelsOnly ? <LabelsList /> : <AllHistoryList />}
      </div>
    </aside>
  )
}

export default ChangeList

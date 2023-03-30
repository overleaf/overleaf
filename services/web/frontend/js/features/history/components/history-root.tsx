import ChangeList from './change-list/change-list'
import DiffView from './diff-view/diff-view'
import { useLayoutContext } from '../../../shared/context/layout-context'
import { useHistoryContext } from '../context/history-context'

export default function HistoryRoot() {
  const { view } = useLayoutContext()
  const { updates } = useHistoryContext()

  if (view !== 'history' || updates.length === 0) {
    return null
  }

  return (
    <div className="history-react">
      <DiffView />
      <ChangeList />
    </div>
  )
}

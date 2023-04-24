import ChangeList from './change-list/change-list'
import DiffView from './diff-view/diff-view'
import { HistoryProvider, useHistoryContext } from '../context/history-context'
import { createPortal } from 'react-dom'
import HistoryFileTree from './history-file-tree'
import LoadingSpinner from '../../../shared/components/loading-spinner'

const fileTreeContainer = document.getElementById('history-file-tree')

function Main() {
  const { loadingState } = useHistoryContext()

  return (
    <>
      {fileTreeContainer
        ? createPortal(<HistoryFileTree />, fileTreeContainer)
        : null}
      <div className="history-react">
        {loadingState === 'loadingInitial' ? (
          <LoadingSpinner />
        ) : (
          <>
            <DiffView />
            <ChangeList />
          </>
        )}
      </div>
    </>
  )
}

export default function HistoryRoot() {
  return (
    <HistoryProvider>
      <Main />
    </HistoryProvider>
  )
}

import { createPortal } from 'react-dom'
import HistoryFileTree from '@/features/history/components/history-file-tree'
import LoadingSpinner from '@/shared/components/loading-spinner'
import DiffView from '@/features/history/components/diff-view/diff-view'
import ChangeList from '@/features/history/components/change-list/change-list'
import { useHistoryContext } from '@/features/history/context/history-context'

export default function History() {
  const { updatesInfo } = useHistoryContext()
  const fileTreeContainer = document.getElementById('history-file-tree')

  return (
    <>
      {fileTreeContainer &&
        createPortal(<HistoryFileTree />, fileTreeContainer)}
      <div className="history-react">
        {updatesInfo.loadingState === 'loadingInitial' ? (
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

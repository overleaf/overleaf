import { createPortal } from 'react-dom'
import HistoryFileTree from '@/features/history/components/history-file-tree'
import LoadingSpinner from '@/shared/components/loading-spinner'
import { useHistoryContext } from '@/features/history/context/history-context'

export default function History() {
  const { updatesInfo } = useHistoryContext()
  const fileTreeContainer = document.querySelector('.history-file-tree')

  return (
    <>
      {fileTreeContainer &&
        createPortal(<HistoryFileTree />, fileTreeContainer)}
      <div className="history-react">
        {updatesInfo.loadingState === 'loadingInitial' ? (
          <LoadingSpinner />
        ) : (
          'History document diff viewer and versions list placeholder'
        )}
      </div>
    </>
  )
}

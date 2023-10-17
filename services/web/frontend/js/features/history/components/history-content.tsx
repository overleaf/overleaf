import { useHistoryContext } from '@/features/history/context/history-context'
import LoadingSpinner from '@/shared/components/loading-spinner'
import DiffView from '@/features/history/components/diff-view/diff-view'
import ChangeList from '@/features/history/components/change-list/change-list'
import { createPortal } from 'react-dom'
import HistoryFileTree from '@/features/history/components/history-file-tree'

const fileTreeContainer = document.getElementById('history-file-tree')

export default function HistoryContent() {
  const { updatesInfo } = useHistoryContext()

  let content
  if (updatesInfo.loadingState === 'loadingInitial') {
    content = <LoadingSpinner />
  } else {
    content = (
      <>
        <DiffView />
        <ChangeList />
      </>
    )
  }

  return (
    <>
      {fileTreeContainer
        ? createPortal(<HistoryFileTree />, fileTreeContainer)
        : null}
      <div className="history-react">{content}</div>
    </>
  )
}

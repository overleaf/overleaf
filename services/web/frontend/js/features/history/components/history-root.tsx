import ChangeList from './change-list/change-list'
import DiffView from './diff-view/diff-view'
import { HistoryProvider, useHistoryContext } from '../context/history-context'
import { createPortal } from 'react-dom'
import HistoryFileTree from './history-file-tree'
import LoadingSpinner from '../../../shared/components/loading-spinner'
import ErrorMessage from './error-message'

const fileTreeContainer = document.getElementById('history-file-tree')

function Main() {
  const { updatesInfo, error } = useHistoryContext()

  let content = null
  if (updatesInfo.loadingState === 'loadingInitial') {
    content = <LoadingSpinner />
  } else if (error) {
    content = <ErrorMessage />
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

export default function HistoryRoot() {
  return (
    <HistoryProvider>
      <Main />
    </HistoryProvider>
  )
}
